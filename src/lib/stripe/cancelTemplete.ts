export const cancelTemplate = () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Payment Cancelled</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #fef2f2;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .card {
          text-align: center;
          padding: 3rem 2rem;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          max-width: 420px;
          width: 90%;
        }
        .icon { font-size: 56px; color: #dc2626; }
        h1 { color: #b91c1c; margin-top: 1rem; font-size: 1.5rem; }
        p { color: #4b5563; margin-top: 0.5rem; line-height: 1.5; }
        .btn {
          display: inline-block;
          margin-top: 1.5rem;
          padding: 0.75rem 2rem;
          background: #dc2626;
          color: #fff;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: background 0.2s;
        }
        .btn:hover { background: #b91c1c; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">❌</div>
        <h1>Payment Cancelled</h1>
        <p>Your transaction was not completed. You can try again anytime.</p>
        <a class="btn" href="/">Return to Homepage</a>
      </div>
    </body>
    </html>
  `;
};
