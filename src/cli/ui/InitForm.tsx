import { createCliRenderer } from '@opentui/core';
import { createRoot, useKeyboard } from '@opentui/react';
import { useState, useCallback } from 'react';
import { SelectList, type SelectOption } from './SelectList.js';

export interface InitFormData {
  platform: 'slack' | 'teams' | 'both';
  setupMethod: 'manual' | 'oauth';
  slack?: {
    appToken: string;
    botToken: string;
    signingSecret?: string;
  };
  teams?: {
    appId: string;
    appPassword: string;
  };
  channel?: {
    key: string;
    workingDirectory: string;
  };
}

type FormStep = 'platform' | 'setupMethod' | 'slackCredentials' | 'teamsCredentials' | 'channel' | 'complete';

interface InitFormProps {
  instanceName: string;
  onComplete: (data: InitFormData) => void;
  onCancel: () => void;
}

const platformOptions: SelectOption<'slack' | 'teams' | 'both'>[] = [
  { label: 'Slack only', value: 'slack', description: 'Connect to Slack workspace' },
  { label: 'Teams only', value: 'teams', description: 'Connect to Microsoft Teams' },
  { label: 'Both', value: 'both', description: 'Connect to both platforms' },
];

const setupMethodOptions: SelectOption<'manual' | 'oauth'>[] = [
  { label: 'Manual', value: 'manual', description: 'Enter tokens manually' },
  { label: 'OAuth', value: 'oauth', description: 'Authenticate via browser' },
];

function InitFormComponent({ instanceName, onComplete, onCancel }: InitFormProps) {
  const [step, setStep] = useState<FormStep>('platform');
  const [data, setData] = useState<Partial<InitFormData>>({});

  // Credential input states
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [teamsAppId, setTeamsAppId] = useState('');
  const [teamsAppPassword, setTeamsAppPassword] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [focused, setFocused] = useState(0);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onCancel();
    }
    if (key.name === 'tab') {
      // Cycle through input fields in credential steps
      if (step === 'slackCredentials') {
        setFocused((f) => (f + 1) % 3);
      } else if (step === 'teamsCredentials') {
        setFocused((f) => (f + 1) % 2);
      } else if (step === 'channel') {
        setFocused((f) => (f + 1) % 2);
      }
    }
  });

  const handlePlatformSelect = useCallback((platform: 'slack' | 'teams' | 'both') => {
    setData({ ...data, platform });
    if (platform === 'teams') {
      setStep('teamsCredentials');
    } else {
      setStep('setupMethod');
    }
  }, [data]);

  const handleSetupMethodSelect = useCallback((method: 'manual' | 'oauth') => {
    setData({ ...data, setupMethod: method });
    if (method === 'oauth') {
      // OAuth flow would be handled externally
      onComplete({ ...data, setupMethod: 'oauth' } as InitFormData);
    } else {
      setStep('slackCredentials');
    }
  }, [data, onComplete]);

  const handleSlackCredentialsSubmit = useCallback(() => {
    if (!slackAppToken || !slackBotToken) {
      return; // Don't submit without required fields
    }
    const newData = {
      ...data,
      slack: {
        appToken: slackAppToken,
        botToken: slackBotToken,
        signingSecret: slackSigningSecret || undefined,
      },
    };
    setData(newData);
    if (data.platform === 'both') {
      setStep('teamsCredentials');
    } else {
      setStep('channel');
    }
  }, [data, slackAppToken, slackBotToken, slackSigningSecret]);

  const handleTeamsCredentialsSubmit = useCallback(() => {
    if (!teamsAppId || !teamsAppPassword) {
      return;
    }
    const newData = {
      ...data,
      teams: {
        appId: teamsAppId,
        appPassword: teamsAppPassword,
      },
    };
    setData(newData);
    setStep('channel');
  }, [data, teamsAppId, teamsAppPassword]);

  const handleChannelSubmit = useCallback(() => {
    const finalData: InitFormData = {
      ...data,
      channel: channelKey && workingDirectory ? {
        key: channelKey,
        workingDirectory,
      } : undefined,
    } as InitFormData;
    onComplete(finalData);
  }, [data, channelKey, workingDirectory, onComplete]);

  const handleSkipChannel = useCallback(() => {
    onComplete(data as InitFormData);
  }, [data, onComplete]);

  return (
    <box style={{ border: true, padding: 2, flexDirection: 'column', gap: 1 }}>
      <text style={{ fg: '#FFD700', bold: true }}>
        Initialize Promptty Instance: {instanceName}
      </text>

      {step === 'platform' && (
        <SelectList
          options={platformOptions}
          onSelect={handlePlatformSelect}
          onCancel={onCancel}
          title="Select platform:"
        />
      )}

      {step === 'setupMethod' && (
        <SelectList
          options={setupMethodOptions}
          onSelect={handleSetupMethodSelect}
          onCancel={() => setStep('platform')}
          title="Slack setup method:"
        />
      )}

      {step === 'slackCredentials' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: '#AAAAAA' }}>Enter Slack credentials:</text>

          <box title="App Token (xapp-...)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xapp-1-..."
              onInput={setSlackAppToken}
              onSubmit={handleSlackCredentialsSubmit}
              focused={focused === 0}
            />
          </box>

          <box title="Bot Token (xoxb-...)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xoxb-..."
              onInput={setSlackBotToken}
              onSubmit={handleSlackCredentialsSubmit}
              focused={focused === 1}
            />
          </box>

          <box title="Signing Secret (optional)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="(optional)"
              onInput={setSlackSigningSecret}
              onSubmit={handleSlackCredentialsSubmit}
              focused={focused === 2}
            />
          </box>

          <text style={{ fg: '#666666' }}>
            Tab: Next field | Enter: Submit | Esc: Back
          </text>
        </box>
      )}

      {step === 'teamsCredentials' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: '#AAAAAA' }}>Enter Teams credentials:</text>

          <box title="App ID" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onInput={setTeamsAppId}
              onSubmit={handleTeamsCredentialsSubmit}
              focused={focused === 0}
            />
          </box>

          <box title="App Password" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="App password/secret"
              onInput={setTeamsAppPassword}
              onSubmit={handleTeamsCredentialsSubmit}
              focused={focused === 1}
            />
          </box>

          <text style={{ fg: '#666666' }}>
            Tab: Next field | Enter: Submit | Esc: Back
          </text>
        </box>
      )}

      {step === 'channel' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: '#AAAAAA' }}>Add first channel (optional):</text>

          <box title="Channel Key (e.g., slack:TWORKSPACE/CCHANNEL)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="slack:T0123456789/C0123456789"
              onInput={setChannelKey}
              onSubmit={handleChannelSubmit}
              focused={focused === 0}
            />
          </box>

          <box title="Working Directory" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="/home/user/projects/myproject"
              onInput={setWorkingDirectory}
              onSubmit={handleChannelSubmit}
              focused={focused === 1}
            />
          </box>

          <box style={{ flexDirection: 'row', gap: 2 }}>
            <text style={{ fg: '#666666' }}>
              Tab: Next field | Enter: Add channel | Esc: Skip
            </text>
          </box>
        </box>
      )}
    </box>
  );
}

/**
 * Run the init form TUI and return the collected data
 */
export async function runInitForm(instanceName: string): Promise<InitFormData | null> {
  return new Promise(async (resolve) => {
    const renderer = await createCliRenderer();
    const root = createRoot(renderer);

    const handleComplete = (data: InitFormData) => {
      root.unmount();
      renderer.cleanup();
      resolve(data);
    };

    const handleCancel = () => {
      root.unmount();
      renderer.cleanup();
      resolve(null);
    };

    root.render(
      <InitFormComponent
        instanceName={instanceName}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  });
}
