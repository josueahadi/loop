import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

// Minimal self-contained HTML pages the emailed links land on (APP_URL + path).
// They read the ?token from the URL and POST to the existing confirm endpoints —
// no separate web client or static hosting needed. Public (the whole point is a
// logged-out user completing reset/verify from an email link).
@ApiExcludeController()
@Controller()
export class AuthPagesController {
  @Public()
  @Get('reset-password')
  @Header('Content-Type', 'text/html; charset=utf-8')
  resetPasswordPage(): string {
    return page(
      'Reset your password',
      /* html */ `
      <form id="f">
        <p>Choose a new password for your Loop account.</p>
        <label>New password
          <input id="pw" type="password" minlength="8" required autocomplete="new-password" />
        </label>
        <label>Confirm password
          <input id="pw2" type="password" minlength="8" required autocomplete="new-password" />
        </label>
        <button type="submit">Reset password</button>
      </form>
      <p id="msg" class="msg"></p>
      <script>
        var token = new URLSearchParams(location.search).get('token');
        var f = document.getElementById('f'), msg = document.getElementById('msg');
        if (!token) { f.style.display='none'; msg.textContent='Missing or invalid link.'; msg.className='msg err'; }
        f.addEventListener('submit', async function (e) {
          e.preventDefault();
          var pw = document.getElementById('pw').value, pw2 = document.getElementById('pw2').value;
          if (pw !== pw2) { msg.textContent='Passwords do not match.'; msg.className='msg err'; return; }
          msg.textContent='Working…'; msg.className='msg';
          try {
            var r = await fetch('/auth/password-reset/confirm', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ token: token, newPassword: pw })
            });
            if (r.ok) { f.style.display='none'; msg.textContent='Password reset. You can now sign in with your new password.'; msg.className='msg ok'; }
            else { msg.textContent='This link is invalid or has expired. Request a new one.'; msg.className='msg err'; }
          } catch (_) { msg.textContent='Something went wrong. Try again.'; msg.className='msg err'; }
        });
      </script>`,
    );
  }

  @Public()
  @Get('verify-email')
  @Header('Content-Type', 'text/html; charset=utf-8')
  verifyEmailPage(): string {
    return page(
      'Verify your email',
      /* html */ `
      <p id="msg" class="msg">Verifying your email…</p>
      <script>
        var token = new URLSearchParams(location.search).get('token');
        var msg = document.getElementById('msg');
        (async function () {
          if (!token) { msg.textContent='Missing or invalid link.'; msg.className='msg err'; return; }
          try {
            var r = await fetch('/auth/email/verify/confirm', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ token: token })
            });
            if (r.ok) { msg.textContent='Email verified. You can return to the Loop app.'; msg.className='msg ok'; }
            else { msg.textContent='This link is invalid or has expired.'; msg.className='msg err'; }
          } catch (_) { msg.textContent='Something went wrong. Try again.'; msg.className='msg err'; }
        })();
      </script>`,
    );
  }
}

// Shared page shell — inline CSS so the page is fully self-contained.
function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Loop</title>
<style>
  :root{--green:#008853}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f8fa;color:#1e293b;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #e7edf2;border-radius:16px;box-shadow:0 4px 12px #0000000a;padding:28px;width:100%;max-width:400px}
  h1{margin:0 0 16px;font-size:22px;color:var(--green)}
  p{font-size:14px;line-height:1.5}
  label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}
  input{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px}
  input:focus{outline:none;border-color:var(--green)}
  button{width:100%;margin-top:20px;padding:13px;background:var(--green);color:#fff;border:0;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
  button:hover{background:#00734a}
  .msg{margin-top:14px}
  .msg.ok{color:var(--green);font-weight:600}
  .msg.err{color:#dc2626;font-weight:600}
</style></head><body><div class="card"><h1>Loop</h1>${body}</div></body></html>`;
}
