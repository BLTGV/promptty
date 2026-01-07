import { createCliRenderer } from '@opentui/core';
import { createRoot, useKeyboard } from '@opentui/react';
import { useState, useCallback } from 'react';
import { SelectList, type SelectOption } from './SelectList.js';

export interface ChannelFormData {
  key: string;
  workingDirectory: string;
  responseFilterMode?: string;
}

export interface CredentialFormData {
  platform: 'slack' | 'teams';
  slack?: {
    appToken: string;
    botToken: string;
    signingSecret?: string;
  };
  teams?: {
    appId: string;
    appPassword: string;
  };
}

interface ChannelFormProps {
  existingKey?: string;
  existingConfig?: { workingDirectory: string; responseFilterMode?: string };
  onComplete: (data: ChannelFormData) => void;
  onCancel: () => void;
}

const responseFilterOptions: SelectOption<string>[] = [
  { label: 'mentions', value: 'mentions', description: 'Only respond when @mentioned (default)' },
  { label: 'all', value: 'all', description: 'Respond to all messages' },
  { label: 'keywords', value: 'keywords', description: 'Respond to specific keywords' },
  { label: 'threads', value: 'threads', description: 'Only respond in threads' },
  { label: 'none', value: 'none', description: 'Disabled' },
];

function ChannelFormComponent({
  existingKey,
  existingConfig,
  onComplete,
  onCancel,
}: ChannelFormProps) {
  const [step, setStep] = useState<'key' | 'directory' | 'filter'>('key');
  const [channelKey, setChannelKey] = useState(existingKey || '');
  const [workingDirectory, setWorkingDirectory] = useState(existingConfig?.workingDirectory || '');
  const [responseFilterMode, setResponseFilterMode] = useState(existingConfig?.responseFilterMode || 'mentions');
  const [focused, setFocused] = useState(0);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      if (step === 'directory') setStep('key');
      else if (step === 'filter') setStep('directory');
      else onCancel();
    }
    if (key.name === 'tab' && (step === 'key' || step === 'directory')) {
      setFocused((f) => (f + 1) % 2);
    }
  });

  const handleKeySubmit = useCallback(() => {
    if (channelKey) {
      setStep('directory');
    }
  }, [channelKey]);

  const handleDirectorySubmit = useCallback(() => {
    if (workingDirectory) {
      setStep('filter');
    }
  }, [workingDirectory]);

  const handleFilterSelect = useCallback((mode: string) => {
    setResponseFilterMode(mode);
    onComplete({
      key: channelKey,
      workingDirectory,
      responseFilterMode: mode,
    });
  }, [channelKey, workingDirectory, onComplete]);

  return (
    <box style={{ border: true, padding: 2, flexDirection: 'column', gap: 1 }}>
      <text style={{ fg: '#FFD700', bold: true }}>
        {existingKey ? 'Edit Channel' : 'Add Channel'}
      </text>

      {step === 'key' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <box title="Channel Key" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="slack:TWORKSPACE/CCHANNEL or teams:TENANT/CHANNEL"
              value={channelKey}
              onInput={setChannelKey}
              onSubmit={handleKeySubmit}
              focused={true}
            />
          </box>
          <text style={{ fg: '#666666' }}>
            Format: slack:TWORKSPACE/CCHANNEL or teams:TENANT/CHANNEL
          </text>
          <text style={{ fg: '#666666' }}>Enter: Continue | Esc: Cancel</text>
        </box>
      )}

      {step === 'directory' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: '#AAAAAA' }}>Channel: {channelKey}</text>
          <box title="Working Directory" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="/path/to/project"
              value={workingDirectory}
              onInput={setWorkingDirectory}
              onSubmit={handleDirectorySubmit}
              focused={true}
            />
          </box>
          <text style={{ fg: '#666666' }}>Enter: Continue | Esc: Back</text>
        </box>
      )}

      {step === 'filter' && (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: '#AAAAAA' }}>Channel: {channelKey}</text>
          <text style={{ fg: '#AAAAAA' }}>Directory: {workingDirectory}</text>
          <SelectList
            options={responseFilterOptions}
            onSelect={handleFilterSelect}
            onCancel={() => setStep('directory')}
            title="Response filter mode:"
            selectedIndex={responseFilterOptions.findIndex((o) => o.value === responseFilterMode)}
          />
        </box>
      )}
    </box>
  );
}

/**
 * Run the channel form TUI
 */
export async function runChannelForm(
  existingKey?: string,
  existingConfig?: { workingDirectory: string; responseFilterMode?: string }
): Promise<ChannelFormData | null> {
  return new Promise(async (resolve) => {
    const renderer = await createCliRenderer();
    const root = createRoot(renderer);

    const handleComplete = (data: ChannelFormData) => {
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
      <ChannelFormComponent
        existingKey={existingKey}
        existingConfig={existingConfig}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  });
}

interface CredentialFormProps {
  platform: 'slack' | 'teams';
  onComplete: (data: CredentialFormData) => void;
  onCancel: () => void;
}

function CredentialFormComponent({ platform, onComplete, onCancel }: CredentialFormProps) {
  const [focused, setFocused] = useState(0);

  // Slack fields
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');

  // Teams fields
  const [teamsAppId, setTeamsAppId] = useState('');
  const [teamsAppPassword, setTeamsAppPassword] = useState('');

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onCancel();
    }
    if (key.name === 'tab') {
      const maxFields = platform === 'slack' ? 3 : 2;
      setFocused((f) => (f + 1) % maxFields);
    }
  });

  const handleSubmit = useCallback(() => {
    if (platform === 'slack') {
      if (!slackAppToken || !slackBotToken) return;
      onComplete({
        platform: 'slack',
        slack: {
          appToken: slackAppToken,
          botToken: slackBotToken,
          signingSecret: slackSigningSecret || undefined,
        },
      });
    } else {
      if (!teamsAppId || !teamsAppPassword) return;
      onComplete({
        platform: 'teams',
        teams: {
          appId: teamsAppId,
          appPassword: teamsAppPassword,
        },
      });
    }
  }, [platform, slackAppToken, slackBotToken, slackSigningSecret, teamsAppId, teamsAppPassword, onComplete]);

  return (
    <box style={{ border: true, padding: 2, flexDirection: 'column', gap: 1 }}>
      <text style={{ fg: '#FFD700', bold: true }}>
        Set {platform === 'slack' ? 'Slack' : 'Teams'} Credentials
      </text>

      {platform === 'slack' ? (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <box title="App Token (xapp-...)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xapp-1-..."
              onInput={setSlackAppToken}
              onSubmit={handleSubmit}
              focused={focused === 0}
            />
          </box>

          <box title="Bot Token (xoxb-...)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xoxb-..."
              onInput={setSlackBotToken}
              onSubmit={handleSubmit}
              focused={focused === 1}
            />
          </box>

          <box title="Signing Secret (optional)" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="(optional)"
              onInput={setSlackSigningSecret}
              onSubmit={handleSubmit}
              focused={focused === 2}
            />
          </box>
        </box>
      ) : (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <box title="App ID" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onInput={setTeamsAppId}
              onSubmit={handleSubmit}
              focused={focused === 0}
            />
          </box>

          <box title="App Password" style={{ border: true, width: 60, height: 3 }}>
            <input
              placeholder="App password/secret"
              onInput={setTeamsAppPassword}
              onSubmit={handleSubmit}
              focused={focused === 1}
            />
          </box>
        </box>
      )}

      <text style={{ fg: '#666666' }}>
        Tab: Next field | Enter: Save | Esc: Cancel
      </text>
    </box>
  );
}

/**
 * Run the credential form TUI
 */
export async function runCredentialForm(platform: 'slack' | 'teams'): Promise<CredentialFormData | null> {
  return new Promise(async (resolve) => {
    const renderer = await createCliRenderer();
    const root = createRoot(renderer);

    const handleComplete = (data: CredentialFormData) => {
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
      <CredentialFormComponent
        platform={platform}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  });
}
