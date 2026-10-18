import config from '../config';

const appName = config.app_name;

/**
 * Generates a styled OTP email HTML string.
 *
 * @param otp - The OTP code to display
 * @param email - The recipient email address
 * @param title - The email subject / heading (e.g. "Verify Your Email")
 */
export const otpEmail = (
  otp: string,
  email: string,
  title: string = 'Verify Your Email Address',
): string => {
  return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#f4f7fb;
  font-family:Arial,sans-serif;
  color:#1f2937;
">

  <!-- Wrapper -->
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    role="presentation"
    style="background-color:#f4f7fb;padding:40px 15px;"
  >
    <tr>
      <td align="center">

        <!-- Container -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="
            max-width:600px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 20px rgba(0,0,0,0.08);
          "
        >

          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                background:linear-gradient(135deg,#1e3a5f,#2563eb);
                padding:40px 30px;
              "
            >
              <h1 style="
                margin:0;
                font-size:28px;
                line-height:36px;
                color:#ffffff;
                font-weight:700;
              ">
                ${appName}
              </h1>

              <p style="
                margin:12px 0 0 0;
                font-size:16px;
                line-height:24px;
                color:#bfdbfe;
              ">
                ${title}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 35px;">

              <p style="
                margin:0 0 16px 0;
                font-size:16px;
                line-height:28px;
                color:#374151;
              ">
                Hello,
              </p>

              <p style="
                margin:0 0 28px 0;
                font-size:15px;
                line-height:26px;
                color:#4b5563;
              ">
                Use the verification code below. It is valid for <strong>10 minutes</strong>.
              </p>

              <!-- OTP Card -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="margin-bottom:32px;"
              >
                <tr>
                  <td align="center">
                    <table
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="
                        background:#eff6ff;
                        border:2px solid #2563eb;
                        border-radius:12px;
                        width:100%;
                        max-width:320px;
                      "
                    >
                      <tr>
                        <td style="padding:24px 20px;" align="center">
                          <p style="
                            margin:0 0 8px 0;
                            font-size:12px;
                            font-weight:700;
                            color:#1d4ed8;
                            letter-spacing:2px;
                            text-transform:uppercase;
                          ">
                            Verification Code
                          </p>
                          <p style="
                            margin:0;
                            font-size:40px;
                            line-height:48px;
                            font-weight:700;
                            letter-spacing:10px;
                            color:#1e3a5f;
                            font-family:'Courier New', monospace;
                          ">
                            ${otp}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Note -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="
                  background:#fefce8;
                  border-left:4px solid #eab308;
                  border-radius:8px;
                  margin-bottom:28px;
                "
              >
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="
                      margin:0;
                      font-size:13px;
                      line-height:22px;
                      color:#713f12;
                    ">
                      🔒 Never share this code with anyone. ${appName} will never ask for your OTP.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="
                margin:0;
                font-size:13px;
                line-height:22px;
                color:#6b7280;
              ">
                If you did not request this email, you can safely ignore it.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background:#f9fafb;
              border-top:1px solid #e5e7eb;
              padding:24px 30px;
              text-align:center;
            ">
              <p style="
                margin:0 0 6px 0;
                font-size:14px;
                font-weight:700;
                color:#111827;
              ">
                ${appName}
              </p>
              <p style="
                margin:0;
                font-size:12px;
                color:#9ca3af;
              ">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};
