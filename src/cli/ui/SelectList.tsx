import { useKeyboard } from '@opentui/react';
import { useState, useEffect } from 'react';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
}

interface SelectListProps<T = string> {
  options: SelectOption<T>[];
  onSelect: (value: T) => void;
  onCancel?: () => void;
  title?: string;
  selectedIndex?: number;
}

export function SelectList<T = string>({
  options,
  onSelect,
  onCancel,
  title,
  selectedIndex: initialIndex = 0,
}: SelectListProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useKeyboard((key) => {
    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex((i) => (i > 0 ? i - 1 : options.length - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex((i) => (i < options.length - 1 ? i + 1 : 0));
    } else if (key.name === 'return') {
      onSelect(options[selectedIndex].value);
    } else if (key.name === 'escape' && onCancel) {
      onCancel();
    }
  });

  return (
    <box style={{ flexDirection: 'column', gap: 1 }}>
      {title && (
        <text style={{ fg: '#FFD700', bold: true }}>{title}</text>
      )}
      <box style={{ flexDirection: 'column' }}>
        {options.map((option, index) => (
          <box key={index} style={{ flexDirection: 'row', gap: 1 }}>
            <text style={{ fg: index === selectedIndex ? '#00FF00' : '#666666' }}>
              {index === selectedIndex ? '>' : ' '}
            </text>
            <text
              style={{
                fg: index === selectedIndex ? '#FFFFFF' : '#AAAAAA',
                bold: index === selectedIndex,
              }}
            >
              {option.label}
            </text>
            {option.description && (
              <text style={{ fg: '#666666' }}> - {option.description}</text>
            )}
          </box>
        ))}
      </box>
      <text style={{ fg: '#666666', marginTop: 1 }}>
        ↑/↓: Navigate | Enter: Select{onCancel ? ' | Esc: Cancel' : ''}
      </text>
    </box>
  );
}
