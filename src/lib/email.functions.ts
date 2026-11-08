import { createServerFn } from "@tanstack/react-start";

export const sendLicenseEmail = createServerFn({ method: "POST" })
  .validator((d: { clientEmail: string; clientName: string; botName: string; licenseKey: string; mentorName: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY is not set; skipping email send.");
      return { sent: false, reason: "missing_api_key" };
    }

    const html = `
      <div style="background-color: #060606; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 12px; border: 1px solid #e2282b; max-width: 540px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #e2282b; letter-spacing: 2px; margin: 0; font-size: 24px;">EA VORTEX</h1>
          <p style="color: #888888; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Power Your Trading</p>
        </div>
        
        <div style="background: #0f0f0f; padding: 20px; border-radius: 8px; border-left: 3px solid #e2282b; margin-bottom: 20px;">
          <h2 style="font-size: 18px; margin: 0 0 10px 0; color: #ffffff;">Welcome aboard, ${data.clientName || data.clientEmail}!</h2>
          <p style="color: #cccccc; font-size: 14px; line-height: 1.5; margin: 0;">
            <strong>${data.mentorName}</strong> has granted you access to <strong>${data.botName}</strong>.
          </p>
        </div>

        <div style="text-align: center; background: #141414; padding: 18px; border-radius: 8px; margin: 25px 0;">
          <p style="color: #888888; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 1px;">Your Personal License Key</p>
          <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #ff4d4f; letter-spacing: 2px;">
            ${data.licenseKey}
          </div>
        </div>

        <p style="color: #22c55e; font-size: 13px; font-weight: 600; text-align: center; margin: 0 0 20px 0;">
          ✓ Auto-Verification Active: Simply sign in with this email and your bot will be unlocked automatically!
        </p>

        <div style="text-align: center; margin-top: 30px;">
          <a href="https://eavortexza.lovable.app/dashboard" style="background: #e2282b; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block;">
            Open Client Dashboard
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #222222; margin: 30px 0 15px 0;" />
        <p style="color: #555555; font-size: 11px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} EA VORTEX · Automated Trading Infrastructure
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EA VORTEX <onboarding@resend.dev>", // Or your domain once verified on Resend
        to: [data.clientEmail],
        subject: `Your ${data.botName} license key is ready`,
        html,
      }),
    });

    const result = await res.json();
    return { sent: res.ok, result };
  });
