# Loop: Technical Report

**A real-time geo-matching platform for cargo owners and drivers in Rwanda**

Habib Josue Ahadi · Mission Capstone · 2026

This report documents what was built, how it maps to the objectives set out in the project proposal, and what the results tell us. It accompanies the source repository, the deployed application, and the walkthrough video, and should be read alongside them. Sections 1 to 3 give the necessary context; [Section 4](#4-analysis-of-the-results) (Analysis), [Section 5](#5-discussion) (Discussion), and [Section 6](#6-recommendations) (Recommendations) carry the substance.

## Contents

1. [Introduction](#1-introduction)
2. [Objectives and how they were addressed](#2-objectives-and-how-they-were-addressed)
3. [Methodology and system overview](#3-methodology-and-system-overview)
4. [Analysis of the results](#4-analysis-of-the-results)
5. [Discussion](#5-discussion)
6. [Recommendations](#6-recommendations)
7. [Conclusion](#7-conclusion)
8. [Appendix: repository, deployment, and video](#8-appendix-repository-deployment-and-video)

---

## 1. Introduction

Loop is a real-time geo-matching mobile platform that connects cargo owners with vehicle drivers in Rwanda. It targets the ad-hoc, individual, and small-business cargo segment that the first wave of enterprise freight platforms left unserved. The problem it addresses has three parts, drawn directly from the proposal: an informal, inefficient matching process in which cargo owners and drivers find one another through personal networks and messaging groups; low vehicle utilisation, most visibly empty return trips; and a deficit of trust between parties who do not know one another.

The response is a focused minimum viable product covering the matching, communication, and trust core: role-based onboarding with mandatory driver verification, a map-based real-time matching view with vehicle-type filtering, a transparent system-suggested price that the owner sets rather than the platform, in-app messaging, a navigation hand-off to the driver's own maps app, and a two-way rating system that builds portable reputation. Payments stay off the platform by design, which keeps Loop lightweight and avoids the working-capital exposure that undermined heavier regional platforms.

The system is a three-tier application: a Flutter mobile client for both roles, a NestJS REST API that owns identity and all domain logic, and a PostgreSQL database with the PostGIS extension as the system of record. A separate Next.js admin console handles driver verification and metrics. The whole stack is deployed and reachable: the API and admin run on Railway, and the mobile app ships as an installable Android APK pointed at the hosted API.

---

## 2. Objectives and how they were addressed

The proposal set one main objective and three specific objectives, each stated below with its outcome; [Section 4](#4-analysis-of-the-results) analyses the outcomes in detail.

**Main objective:** design, develop, and evaluate a real-time geo-matching platform that reduces matching friction, improves cargo-vehicle utilisation, and strengthens trust between cargo owners and drivers.

**Specific objective 1: review the literature and collect requirements.** Addressed in the proposal's literature review and requirements chapters. The current-practice data gathered there is what seeds the pricing configuration (base fare and per-kilometre rate per vehicle type), rather than hard-coded values.

**Specific objective 2: design and develop the MVP across iterative cycles.** Fully addressed. The MVP was built in six milestones (M1 to M6, plus an M3.5 location increment), each delivering a working slice: foundation and auth, matching, pricing and jobs, location and geocoding, the transaction loop, trust and ratings, and the admin console. Every functional requirement is implemented ([Section 4.1](#41-functional-requirements-a-traceability-view)).

**Specific objective 3: evaluate against measurable metrics.** Partially addressed. The metrics themselves (time-to-match, driver availability within a radius, in-app coordination share, share of jobs posted at the suggested price, and a pre/post change in trust perception) are defined, and the system is instrumented to produce most of them. The participant evaluation that yields the numbers is the next step and had not been run at the time of writing. What has been verified is that the platform functions end to end and that the deployment is live and correct ([Section 4.3](#43-deployment-and-end-to-end-verification)).

---

## 3. Methodology and system overview

The work followed Design Science Research Methodology: identify the problem, define objectives, design and build the artefact, demonstrate it, and evaluate it. Development used an iterative, incremental software development life cycle in short cycles, each producing a demonstrable increment. This suited a project whose requirements were expected to evolve with user feedback and reduced the risk of building features that did not serve the matching, utilisation, or trust problems.

The architecture is the standard three-tier shape the proposal specified. The presentation tier is a Flutter application serving both the cargo-owner and driver experiences. The application tier is a NestJS REST API organised into seventeen feature modules (auth, users, vehicles, verification, matching, pricing, jobs, proposals, messaging, ratings, notifications, admin, geocode, storage, mail, push, health), each with its own controller, service, DTOs, and entities, plus a shared layer of guards, decorators, and enums. The data tier is PostgreSQL with PostGIS for the structured domain data and all proximity queries, with Firebase Storage holding verification documents by reference. Authentication is a NestJS-issued JWT scheme (access plus rotating refresh tokens, argon2 password hashing); Firebase is used only for object storage and push, never for identity.

A deliberate design decision runs through the whole system: all geospatial computation is delegated to PostGIS and never re-implemented in application code. Both the trip distance used for pricing and the nearby-driver ranking are SQL over `geography`-typed points, which keeps the maths correct and consistent and avoids a class of floating-point and projection bugs.

---

## 4. Analysis of the results

The results below separate what has been built and verified in code and deployment from what still depends on a participant study.

### 4.1 Functional requirements: a traceability view

Every functional requirement in the proposal is implemented. The table maps each requirement to where it lives in the code.

| Req | Requirement | Status | Where it lives (evidence) |
| --- | --- | --- | --- |
| FR1 | Role-based onboarding and profile management | Implemented | Role set at registration; editable name, contact, and photo via the users module (`api/src/modules/users/`). |
| FR2 | Mandatory driver verification, admin-reviewed | Implemented | Three required documents; going online is blocked until all three are approved (`verification` module; `users.service` online gate). |
| FR3 | Vehicle management and availability toggle | Implemented | Vehicle create/update/delete with type, capacity, and photo; online/offline toggle that also captures location (`vehicles`, `users` modules). |
| FR4 | Real-time map-based geo-matching, filtered by type and proximity | Implemented | PostGIS proximity query, vehicle-type filter, ordered by distance (`matching.service`); `flutter_map` / OpenStreetMap view on the client. |
| FR5 | System-suggested pricing, configurable and owner-editable | Implemented | Formula over DB-held config, with the estimate and the owner's price stored separately (`pricing.service`, `job` entity). |
| FR6 | Job posting with full load terms; proposal accept or decline | Implemented | Job carries size, weight, type, pickup, drop-off, and required vehicle type; proposals accept/decline with a state machine (`jobs`, `proposals` modules). |
| FR7 | In-app messaging on acceptance, with push | Implemented | A message thread opens only once a proposal is accepted; delivery over a WebSocket gateway with push on send (`messaging` module). |
| FR8 | Two-way rating after completion, aggregated on profiles | Implemented | Participant-only, once per direction, on a completed job; averages written back to the user (`ratings.service`). |
| FR9 | Admin verification dashboard | Implemented | Approve or reject with a reason, plus server-computed metrics (`admin` module; Next.js verification queue). |

Two implementation details show where the proposal's design intent is realised most directly.

**The pricing rule is rule-based and transparent.** The suggested price is `base_fare + (rate_per_km(vehicle_type) × distance_km) × size_factor`, computed in the pricing service and rounded to whole Rwandan francs (the currency has no minor unit, so amounts are integers and are never multiplied by a hundred). The base fare and per-kilometre rates are read from a configuration table seeded from requirements data, not hard-coded, so they can be corrected without a redeploy. The distance term is the straight-line distance computed by PostGIS between the pickup and drop-off points, not an application-side calculation. The figure is a suggestion: the estimate and the owner's chosen price are stored as separate fields, and the owner sets the final price. This matches the cold-start, owner-set, transparent design set out in the proposal, and stops short of the machine-learning pricing model reserved for future work.

**The matching query enforces every safety and trust condition at once.** A single PostGIS statement returns drivers who are within the search radius, ordered by distance, and filters to those who are online, have a location, hold all three approved verification documents, and are not already committed to another active job. In other words, a driver must be verified, available, and not double-booked to appear. This directly satisfies the proposal's requirement that only available, verified drivers are surfaced, and it does so on the database side rather than by filtering in the app after the fact.

### 4.2 Non-functional requirements

| Req | Requirement | Status | Notes |
| --- | --- | --- | --- |
| NF1 | Matching and key interactions return within a few seconds | Met in practice | PostGIS proximity queries are indexed spatial lookups; interactions are single API round-trips. A formal latency measurement is part of the pending evaluation. |
| NF2 | Encrypted transport, secure sessions, role-based access | Met, infra-provided TLS | JWT with rotating refresh tokens, argon2 hashing, and a single role guard across the API. Transport TLS is terminated at the platform edge; the private API-to-database hop runs on the internal network. |
| NF3 | Least-privilege handling of documents and location | Met | Verification documents live in a private bucket and are served only through short-lived signed URLs to an authorised admin; a driver's live location is never exposed before a match. |
| NF4 | Clean, localisable interface usable with minimal steps | Met | Consistent theme and shared widgets; onboarding is a short, role-based flow. |
| NF5 | Reliability with tolerance for intermittent connectivity | Partially met | The API runs warm (no cold-start sleeping); the client handles session recovery. Offline caching is limited. |
| NF6 | Modular, extensible architecture with audited decisions | Met | Seventeen self-contained modules; every verification decision persists the reviewer and reason and writes an audit-log row surfaced at an admin endpoint. |

### 4.3 Deployment and end-to-end verification

The system is deployed and verified in its target environment. The API and admin run as separate services on Railway alongside a PostGIS database; the mobile app is an Android APK built against the hosted API. A verification checklist was run against the live stack and recorded in the deployment guide: health check, documentation, registration, login and identity, guarded admin metrics, geocoding, and live document upload with a real signed URL all passed against production. The interactive product loop (post a job, propose, accept, chat, complete, rate) runs from the same hosted stack through the mobile app and the admin console.

Testing is layered by tier: unit tests for the custom logic, widget tests for the mobile screens, integration against a live API and real PostGIS during development, a manual end-to-end matrix across two roles plus admin, and the post-deploy verification above. The automated suite concentrates on the logic where correctness matters most and a fast test is meaningful: the pricing formula and its rounding and error paths, the proposal accept/decline state machine, the authentication boundary, and the verification access guard. Geospatial distance is delegated to PostGIS and therefore verified by running against a real database rather than by re-implementing and unit-testing the maths.

### 4.4 Test results

Testing has two layers of evidence. The automated suites and the hosted-stack deployment checks are recorded below with their observed results. The manual and exploratory tables that follow capture the interactive product loop driven by hand across two roles and the admin, on real and emulated devices.

**Automated and deployment results (verified).**

| Check | What it covers | Result |
| --- | --- | --- |
| API unit suite (Jest) | pricing formula and rounding, proposal accept/decline state machine, auth boundary, verification access guard | 22 tests across 4 suites, all passing |
| Admin unit suite (Vitest) | directory pagination query builder; metrics formatters (null renders as "No data yet") | present and passing |
| Mobile suite (Flutter) | model JSON round-trip, screen render/input, widget tests | 9 test files, passing |
| Hosted health | `GET /health` on the deployed API | 200 `{"status":"ok"}` |
| Auth guard on admin metrics | `GET /admin/metrics` without a token | 401 (guarded, no wildcard) |
| API documentation | `GET /docs` (Swagger UI) on the deployed API | 200, renders |
| Live document signed URL | driver upload, then admin fetch of a signed view URL | real Firebase-signed URL, fetch returns 200 |

The full hosted-stack checklist, including the exact commands, is in the deployment guide (Section 4.3 and DEPLOYMENT.md section 9).

**End-to-end product loop.** Each flow driven across a cargo-owner account and a driver account, plus the admin console, against the hosted API.

| # | Flow | Inputs used | Result | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Register and log in (both roles) | new owner + new driver | Pass | | Session survives app restart. |
| 2 | Driver verification and admin review | 3 documents; approve one, reject one with a reason | Pass | [upload](../screenshots/01-mobile-driver-verification-upload.png), [queue](../screenshots/02-admin-admin-verification-queue.png), [review](../screenshots/03-admin-admin-document-review.png), [reject](../screenshots/03-admin-admin-document-review-reject.png) | Driver sees the decision in-app. |
| 3 | Go online (gated on verification + vehicle) | try online before and after approval | Pass | [shot](../screenshots/04-mobile-driver-online.png) | Blocked until verified and a vehicle is added. |
| 4 | Create a job and see the estimate | Remera → Kimironko, van, medium | Pass | [create](../screenshots/05-mobile-owner-create-job.png), [estimate](../screenshots/06-mobile-owner-cost-estimate.png) | Estimate shown; owner sets the final price. |
| 5 | Nearby matching | owner near an online driver; wrong vehicle-type filter then right | Pass | [shot](../screenshots/07-mobile-owner-nearby-drivers.png) | Only verified, online drivers appear, nearest first. |
| 6 | Send proposal, accept / decline | accept on one; a second pending proposal auto-declines | Pass | [propose](../screenshots/08-mobile-owner-send-proposal.png), [request](../screenshots/09-mobile-driver-job-request.png) | Other pending proposals auto-decline on accept. |
| 7 | In-app messaging | message each way; check real-time arrival | Pass | [shot](../screenshots/10-mobile-both-chat.png) | Delivered in real time over the WebSocket. |
| 8 | Navigation hand-off | open pickup + drop-off in the device maps app | Pass | | Deep-links to the installed maps app. |
| 9 | Complete and rate (two-way) | owner marks in-progress then completed; both rate | Pass | [rate](../screenshots/12-mobile-owner-rate-driver.png), [ratings](../screenshots/14-mobile-driver-my-ratings.jpeg) | Averages update on both profiles. |
| 10 | Admin directory + metrics | paginate/filter the tables; read the metrics dashboard | Pass | [metrics](../screenshots/13-admin-admin-metrics.png) | Server-computed metrics render. |
| — | Push notification delivery (cross-cutting) | proposal / message / verification pushes | Fail (re-testing) | | In-app notifications arrive; FCM push did not deliver on the test device. Under re-test with a fresh build; results to be updated. |

**Edge cases and varied inputs.** Abnormal or boundary inputs exercised beyond the happy path.

Rows marked with an automated test are covered by the unit or integration suites; the remaining rows are left for the manual capture run.

| Case | What was exercised | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Zero-distance job | pickup equals drop-off (price should be the base fare only) | Pass | | Covered by `pricing.service.spec` (base fare at zero distance). |
| Vehicle-type variation | the estimate changes across `moto` / `pickup` / `van` / `small_truck` / `large_truck` | Pass | | Per-type `rate_per_km` from config; covered by the pricing tests. |
| Size variation | the estimate scales with `small` / `medium` / `large` | Pass | | Size-multiplier scaling covered by `pricing.service.spec`. |
| Location variation | different Kigali points change distance and nearby ordering (Remera, Kimironko, 2000 Hotel, Downtown) | Pass | | Different pickup/drop-off points produced different distances and estimates, and changed the nearby-driver ordering. |
| Driver with no vehicle | going online is blocked | | | |
| Rejected document | driver sees the rejection and can re-upload; re-upload returns to pending | Pass | [shot](../screenshots/11-mobile-driver-verification-rejected.png) | Admin rejects with a reason; the driver sees it and can re-submit, which returns the record to pending. |
| Already-matched job | a second proposal on a matched job is rejected | Pass | | Covered by `proposals.service.spec` (conflict when already matched). |
| Busy driver | an assigned driver drops out of the nearby results until the job completes | Pass | | Enforced in the matching query (`NOT EXISTS` on active accepted proposals). |
| Dead session | an expired/invalid session recovers to login rather than stranding on an error | Pass | | Session-death path routes to login instead of surfacing a raw 401. |

**Environment and device coverage.** The same build exercised across hardware and software environments, per the constraints in the testing document.

| Environment | Build / OS | Flows run | Result | Notes |
| --- | --- | --- | --- | --- |
| Android device | Pixel 4a, Android 13 | full loop, maps hand-off, push | Pass (loop); push Fail | An older device, and the physical Android handset available for testing. Core loop and maps hand-off worked; FCM push did not deliver. Under re-test with a fresh build; results to be updated. |
| Android emulator | Pixel 6a AVD | availability / go-online flow | Pass | Going online (verification and vehicle gating, availability toggle) verified. |
| iOS simulator | iPhone 16, iOS 18.4 | full loop except remote push | Pass | Simulators cannot receive remote push; the rest of the loop ran. |
| iOS device | iPhone 16 Pro, iOS 18 | full loop (remote push needs a paid APNs key) | Pass | Core loop ran; remote push is inert without a paid Apple Developer APNs key. Older iPhone models are still to be tested. |
| Admin (web) | _browser_ | verification queue, directories, metrics | | |

### 4.5 Where the results fall short of the proposal

Six gaps stand out.

First, and most importantly, **the quantitative user-study metrics have not yet been collected.** The third specific objective calls for time-to-match, driver-within-radius availability, in-app coordination share, share-at-suggested-price, and a pre/post trust measure, gathered from participating Kigali cargo owners and drivers. The platform is built and instrumented to support that study, but the study itself is the outstanding piece. Every objective that depends on running the platform is met; every objective that depends on running the platform *with participants and measuring them* is pending.

Second, **automated test coverage is uneven.** It is strong on the pieces most likely to be wrong in a subtle way (pricing, the proposal state machine, auth, verification access), but several domain services (jobs, matching, ratings, messaging) have no dedicated unit tests, and the mobile tests are render-level smoke tests rather than behavioural ones. The end-to-end correctness of those paths is covered by the manual matrix and live integration, but not yet by fast, repeatable automated checks.

Third, **one internal convention is aspirational rather than realised.** The design intended a single API contract from which the client types would be generated. The API does publish an OpenAPI (Swagger) specification, but the admin and mobile types are currently hand-written, so the single-source guarantee is not yet enforced in the build. This is a maintainability nuance, not a functional defect, and it is called out again in the recommendations.

Fourth, **the price estimate uses straight-line distance, not road distance.** The estimate is computed from the great-circle distance between pickup and drop-off, which under-states the true kilometres a driver actually travels on Kigali's road network, and by a variable amount depending on the route. Because the estimate is the owner's reference for setting the price, this is a limitation of a core feature rather than of a peripheral one. It was a deliberate cold-start choice: at launch there is no routing dependency to configure, meter, or pay for, and the owner always sets the final price so the estimate is a guide rather than a binding figure. Closing the gap is a contained change ([Section 6.3](#63-product-and-community-future-work)): the same formula would consume a road distance from a routing service in place of the great-circle term.

Fifth, **push notification delivery is platform-constrained.** The push path is implemented end to end (the app registers a device token against the user, and the API sends through Firebase Cloud Messaging), but delivery depends on the platform. On iOS, remote push requires an APNs key that in turn requires a paid Apple Developer account, so iOS push is inert until that account is in place; the app runs normally without it. On Android, push works on a real device or an emulator image that includes Google Play services, and it depends on the user granting the notification permission. In-app notifications do not have this constraint: they are persisted server-side regardless of the push driver and are shown in the notification centre whether or not the device push arrives.

Sixth, **the app can be unreachable from one Rwandan mobile network because of a carrier-to-host routing problem, not a defect in Loop.** During device testing, the app timed out at connection on MTN Rwanda mobile data while working normally on Wi-Fi and on other networks. Investigation showed the API itself was healthy (it returned HTTP 200 within about two seconds when reached through an external proxy that takes a different network path), but the single edge IP that the hosting provider's domain resolves to was not routable from that carrier — a peering or routing blackhole to that specific address, which no code change can fix. This matters for the evaluation because participants may be on mobile data. The durable remedy is to stop depending on that single provider edge IP by fronting the API with a custom domain behind a CDN (Cloudflare) whose edge the local carriers reach reliably; the CDN reaches the host from its own healthy path. This is a configuration change in keeping with the deployment posture (no code rewrite), and the step-by-step plan is in the deployment guide (Section 4.3 and DEPLOYMENT.md section 12).

---

## 5. Discussion

Beyond whether each milestone was met, several choices in the build shaped the result and carry implications for the project's goals.

**The order of the milestones encoded the argument of the project.** Verification and the trust gate came first, before any matching existed, because trust is the differentiator the literature identified and the thing that distinguishes Loop from an unstructured messaging group. Matching came before pricing, and pricing before the transaction loop, because each layer only makes sense on top of the last: there is no point suggesting a price for a trip until the system can find the driver who would make it, and no point opening a chat until a proposal has been accepted. Building in that order meant every increment was demonstrable on its own and the risky, defining features were proven early rather than deferred.

**Keeping geospatial logic in PostGIS underpins the result.** It is the reason the distance used for pricing and the distance used for ranking drivers are the same computation, on the same projection, with the same correctness guarantees. Had that logic been re-implemented in the client or the API, the two would inevitably have drifted, and a pricing figure that disagreed with the map would have undermined the transparency the whole pricing design depends on. Delegating it to the database was a small architectural choice with an outsized payoff in consistency.

**Keeping payments off the platform was a scoping decision with real weight.** The literature review found that the regional platforms that struggled were precisely the ones carrying capital: paying drivers upfront while waiting on shippers. By arranging settlement directly between owner and driver, Loop sidesteps that failure mode entirely and stays light enough to run on a pilot budget. This is not a missing feature but a deliberate boundary, and it keeps the trust-and-matching core at the centre of the product rather than one feature among many.

**The impact of the results is best understood as a proven mechanism, not yet a measured outcome.** What the project demonstrates is that the mechanism the proposal hypothesised can be built and works: a cargo owner can, on a real device against a live backend, see verified nearby drivers, get a transparent price they control, send a proposal, coordinate in-app, and exchange ratings. Whether that mechanism moves the needle on time-to-match and empty trips for real users is the question the pending evaluation answers. The value of having built and deployed the artefact is that the evaluation is now a matter of running a study, not of finishing the software.

**The modular structure supports the proposal's extensibility goals.** Seventeen independent modules, a single API client, a single role guard, and a single theme make the system extensible along the axes the proposal cared about: new vehicle types are configuration, and new locations need no code change because proximity is computed generically. The places where the structure is less tidy (the mobile folder layout, the un-generated client types) are consistency wrinkles rather than structural faults, and they are cheap to correct.

**Testing on real devices surfaced issues an emulator hid, and they were fixed in the same iteration.** Two are worth noting. First, taking a photo or opening the gallery failed on device because the camera and media permissions were never declared in the platform manifests; this was corrected by declaring them and by not over-requesting a permission the modern OS photo picker does not need. Second, when the network was slow or the API was briefly unreachable, the app rendered the raw framework exception to the user, for example a Dio timeout reading "the request connection took longer than 0:00:15.000000 and it was aborted…" on the login and registration screens (captured in `screenshots/raw-error-login-before-fix.jpeg` and `screenshots/raw-error-register-before-fix.jpeg`). A shared error mapper now turns these into plain language ("The connection timed out. Please check your network and try again."; "The service is temporarily unavailable."), and server errors never expose a stack or body. Both fixes came directly out of hands-on device testing rather than the automated suite, which is a fair illustration of why the manual matrix earns its place alongside the unit tests.

---

## 6. Recommendations

The recommendations fall into three groups: completing the evaluation, hardening what exists, and the future-work roadmap for the product and the community it serves.

### 6.1 Complete the evaluation

The single highest-value next step is to run the participant study the third objective describes. Recruit a small purposive sample of Kigali cargo owners and drivers, capture the pre-intervention trust and empty-trip baseline, have them run real matches through the deployed app, and record time-to-match, whether a driver was available within the radius, the share of coordination done in-app, and the share of jobs posted at the suggested price unchanged. Then measure the post-intervention trust perception. The platform already produces or can easily log every one of these; what remains is the fieldwork. This turns the report's "proven mechanism" into a "measured outcome" and closes the one objective that is currently partial.

### 6.2 Harden what exists

- **Front the API with a custom domain behind a CDN, before the defence.** This is the most time-sensitive item, because it fixes the mobile-network reachability problem (Section 4.5) that can otherwise stop a participant on the affected carrier from using the app at all. The plan is a Cloudflare-proxied custom domain (steps in DEPLOYMENT.md section 12); it is a configuration change, not a rewrite.
- **Broaden automated test coverage** to the domain services that currently rely on manual verification: jobs, matching, ratings, and messaging. Behavioural tests on the mobile client (not just render smoke tests) would follow.
- **Generate the client types from the OpenAPI specification** so the single-contract intent is actually enforced and API-client drift becomes impossible rather than merely unlikely.
- **Add offline tolerance** where it matters most for Rwandan conditions: cache the last-known matching view and queue outbound messages, given the mixed connectivity the literature documents.

### 6.3 Product and community future work

These are reserved deliberately, in keeping with the proposal's scope, and are the natural next phases once the pilot is validated.

- **Road-distance routing for the price estimate.** This is the most important of the product enhancements, because it sharpens a core feature. Replacing the straight-line distance term with a real road distance from a routing service (for example a self-hosted OSRM instance, GraphHopper, or a commercial directions API) makes the estimate reflect the kilometres a driver actually drives. It is a contained, backend-only change: the pricing formula, the configuration, and the stored fields all stay the same, and only the source of `distance_km` changes. The main decision is the dependency: a self-hosted engine keeps the "no key, no Google" stance at the cost of running one more service, whereas a commercial API is simpler to wire but adds a metered, key-gated dependency. **In-app turn-by-turn navigation is a separate and much larger undertaking** and should remain out of scope: it requires a navigation SDK (voice guidance, off-route re-routing, GPS map-matching), which is heavy on the client and typically proprietary and metered. The current deep-link hand-off already gives the driver full turn-by-turn inside the maps app they trust, at no implementation or running cost, so building navigation into Loop would be considerable effort to end up with something the hand-off already does well.
- **A single structured counter-offer.** The proposal identified this as the immediate next step beyond the posted-price model: allowing a driver to propose one alternative price the owner can accept or decline, which the literature suggests improves outcomes as the marketplace gains liquidity.
- **In-app payments, staged.** Beginning with a deep link to the mobile-money transfer flow already ubiquitous in Rwanda, and only later card and payment-service-provider integration with escrow. This must be approached carefully, because carrying capital is exactly what strained comparable platforms; the recommendation is to add convenience without taking on settlement risk.
- **Live driver tracking and a learned pricing model.** Once there is transaction history, the rule-based estimator can be replaced by a data-driven model trained on completed jobs and accepted prices, and the owner can watch the assigned driver approach after acceptance. Both build on infrastructure the app already has.
- **For the community and operators.** Loop is positioned as a lightweight, trust-first alternative to both enterprise freight platforms and informal channels. The recommendation to any operator taking it forward is to preserve that focus: the value is in doing the matching-and-trust core well for the ad-hoc, small-business segment, not in bundling adjacent services that dilute it. Localisation into Kinyarwanda and attention to low-end devices would widen access in exactly the market the project set out to serve.

---

## 7. Conclusion

Loop set out to build and evaluate a real-time geo-matching platform for Rwanda's ad-hoc cargo market, targeting matching friction, low utilisation, and the trust deficit. The build and deployment objectives are fully met: every functional requirement is implemented and traceable to code, the non-functional requirements are substantially met, and the system is live and verified end to end in its target environment. The evaluation objective is partially met: the metrics are defined and the platform is instrumented for them, but the participant study that produces the numbers is the outstanding step. Loop is a working, deployed artefact that proves its mechanism, with a clearly defined and now-unblocked path to measuring its impact.

---

## 8. Appendix: repository, deployment, and video

- **Source repository and README:** the monorepo (`mobile/`, `api/`, `admin/`, `docs/`), with installation and quick-start instructions.
- **Deployed application:** the hosted API and admin console, and an installable Android APK.
- **Walkthrough video:** a five-minute demonstration of the core loop.
- **Supporting documents in the repository:** the deployment guide (reproducible steps and the live verification checklist), the testing document (strategies, the automated suites, and the manual end-to-end matrix), and the engineering build specification.
