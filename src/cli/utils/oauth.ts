import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import { execSync } from 'child_process';
import { platform } from 'os';

const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export interface SlackOAuthResult {
  botToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
}

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const os = platform();
  try {
    if (os === 'darwin') {
      execSync(`open "${url}"`);
    } else if (os === 'win32') {
      execSync(`start "${url}"`);
    } else {
      // Linux/Unix - try various options
      try {
        execSync(`xdg-open "${url}"`);
      } catch {
        try {
          execSync(`sensible-browser "${url}"`);
        } catch {
          console.log(`Please open this URL in your browser: ${url}`);
        }
      }
    }
  } catch {
    console.log(`Please open this URL in your browser: ${url}`);
  }
}

/**
 * Run Slack OAuth flow to obtain bot token
 *
 * Note: This flow obtains the bot token (xoxb-). The app-level token (xapp-)
 * required for Socket Mode must be generated manually in the Slack App settings.
 */
export async function runSlackOAuth(
  clientId: string,
  clientSecret: string
): Promise<SlackOAuthResult> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout;

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          clearTimeout(timeoutId);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          clearTimeout(timeoutId);
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        try {
          // Exchange code for tokens
          const response = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: REDIRECT_URI,
            }),
          });

          const data = (await response.json()) as {
            ok: boolean;
            error?: string;
            access_token?: string;
            team?: { id: string; name: string };
            bot_user_id?: string;
          };

          if (!data.ok) {
            throw new Error(data.error || 'OAuth token exchange failed');
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: green;">Authentication Successful!</h1>
                <p>Connected to workspace: ${data.team?.name || 'Unknown'}</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          clearTimeout(timeoutId);
          server.close();

          resolve({
            botToken: data.access_token!,
            teamId: data.team?.id || '',
            teamName: data.team?.name || '',
            botUserId: data.bot_user_id || '',
          });
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>Error exchanging authorization code.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          clearTimeout(timeoutId);
          server.close();
          reject(error);
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(REDIRECT_PORT, () => {
      // Build OAuth URL with required scopes
      const scopes = [
        'app_mentions:read',
        'channels:history',
        'channels:read',
        'chat:write',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'im:write',
        'mpim:history',
        'mpim:read',
        'users:read',
      ].join(',');

      const authUrl =
        `https://slack.com/oauth/v2/authorize?` +
        new URLSearchParams({
          client_id: clientId,
          scope: scopes,
          redirect_uri: REDIRECT_URI,
        }).toString();

      console.log('Opening browser for Slack authentication...');
      console.log('');
      console.log('If your browser does not open, visit this URL:');
      console.log(authUrl);
      console.log('');

      openBrowser(authUrl);
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout - authentication took too long'));
    }, 300000);
  });
}

/**
 * Instructions for obtaining the Slack App Token (xapp-)
 *
 * The app-level token cannot be obtained via OAuth and must be generated
 * manually in the Slack App settings.
 */
export function getAppTokenInstructions(): string {
  return `
To obtain a Slack App Token (xapp-):

1. Go to https://api.slack.com/apps
2. Select your app
3. In the sidebar, click "Basic Information"
4. Scroll to "App-Level Tokens"
5. Click "Generate Token and Scopes"
6. Name your token (e.g., "promptty")
7. Add the "connections:write" scope
8. Click "Generate"
9. Copy the token (starts with xapp-)

This token is required for Socket Mode connections.
`.trim();
}
