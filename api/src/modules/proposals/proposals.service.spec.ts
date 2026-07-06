import { ConflictException, NotFoundException } from '@nestjs/common';
import { JobStatus, ProposalStatus } from '../../common/enums';
import { ProposalsService } from './proposals.service';

// Unit tests for the proposal accept/decline state machine (scope: accept or
// decline only, no negotiation). Repositories + push are mocked; we assert the
// guard rules that keep a job from being double-matched.
describe('ProposalsService.respond', () => {
  const DRIVER = 'driver-1';
  const OTHER_DRIVER = 'driver-2';

  function makeService(proposal: any) {
    const proposalsRepo = {
      findOne: jest.fn(() => Promise.resolve(proposal)),
      save: jest.fn((p: any) => Promise.resolve(p)),
      manager: { transaction: jest.fn(async (cb: any) => cb({ update: jest.fn() })) },
    };
    const jobsRepo = {};
    const usersRepo = {};
    const push = { sendToUser: jest.fn() };
    const service = new ProposalsService(
      proposalsRepo as any,
      jobsRepo as any,
      usersRepo as any,
      push as any,
    );
    // coordsFor hits the DB; stub it so the accept/decline paths stay pure.
    jest
      .spyOn(service as any, 'coordsFor')
      .mockResolvedValue(new Map());
    return { service, proposalsRepo, push };
  }

  const baseProposal = () => ({
    id: 'prop-1',
    driverId: DRIVER,
    jobId: 'job-1',
    status: ProposalStatus.SENT,
    job: {
      id: 'job-1',
      ownerId: 'owner-1',
      status: JobStatus.POSTED,
      owner: { id: 'owner-1', name: 'Owner', phone: '+250780000000' },
    },
  });

  it('rejects a response from a driver who does not own the proposal', async () => {
    const { service } = makeService(baseProposal());
    await expect(
      service.respond(OTHER_DRIVER, 'prop-1', ProposalStatus.ACCEPTED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the proposal does not exist', async () => {
    const { service } = makeService(null);
    await expect(
      service.respond(DRIVER, 'missing', ProposalStatus.ACCEPTED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('conflicts when accepting a job that is already matched', async () => {
    const p = baseProposal();
    p.job.status = JobStatus.MATCHED; // another driver already took it
    const { service } = makeService(p);
    await expect(
      service.respond(DRIVER, 'prop-1', ProposalStatus.ACCEPTED),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('conflicts when responding to an already-responded proposal with a different status', async () => {
    const p = baseProposal();
    p.status = ProposalStatus.DECLINED;
    const { service } = makeService(p);
    await expect(
      service.respond(DRIVER, 'prop-1', ProposalStatus.ACCEPTED),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('is idempotent: re-declining an already-declined proposal returns, no error', async () => {
    const p = baseProposal();
    p.status = ProposalStatus.DECLINED;
    const { service } = makeService(p);
    await expect(
      service.respond(DRIVER, 'prop-1', ProposalStatus.DECLINED),
    ).resolves.toBeDefined();
  });

  it('declines a pending proposal and notifies the owner', async () => {
    const { service, proposalsRepo, push } = makeService(baseProposal());
    await service.respond(DRIVER, 'prop-1', ProposalStatus.DECLINED);
    expect(proposalsRepo.save).toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({ data: expect.objectContaining({ type: 'proposal_declined' }) }),
    );
  });

  it('accepts a pending proposal on an open job inside a transaction', async () => {
    const { service, proposalsRepo } = makeService(baseProposal());
    await service.respond(DRIVER, 'prop-1', ProposalStatus.ACCEPTED);
    // Accept path runs in a transaction (updates proposal + job + auto-declines others).
    expect(proposalsRepo.manager.transaction).toHaveBeenCalled();
  });
});
