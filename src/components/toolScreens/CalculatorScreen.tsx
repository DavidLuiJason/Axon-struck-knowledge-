/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calculator Screen: Type a sum, get the answer.
 * Uses the pure calculator engine in src/tools/engines/numbers/calculator.ts.
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  OptionsDisclosure,
  SegmentedChoice,
  SingleLineField,
} from '../tools/ToolParts';
import { evaluate } from '../../tools/engines/numbers/calculator';

export const toolScreen = { toolId: 'calculator' };

export interface CalculatorScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const CalculatorScreen: React.FC<CalculatorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [expression, setExpression] = useState('');
  const [angleUnit, setAngleUnit] = useState<'rad' | 'deg'>('rad');
  const [copied, setCopied] = useState(false);

  // Evaluate live as the user types
  const result = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return null;
    return evaluate(trimmed, { angle: angleUnit });
  }, [expression, angleUnit]);

  const handleCopy = async () => {
    if (result && result.ok) {
      const ok = await copyToClipboard(result.formatted);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleClear = () => {
    setExpression('');
  };

  const getErrorMessage = (code: string, pos?: number) => {
    const atPos = typeof pos === 'number' ? ` at character ${pos + 1}` : '';
    switch (code) {
      case 'syntax':
        return `Syntax error${atPos}. Check operators, numbers, and parentheses.`;
      case 'division-by-zero':
        return `Cannot divide by zero${atPos}.`;
      case 'domain':
        return `Math domain error${atPos} (e.g. square root of a negative number).`;
      case 'too-long':
        return 'Expression is too long (maximum 512 characters).';
      default:
        return `Calculation error: ${code}`;
    }
  };

  return (
    <ToolScreenShell
      toolName="Calculator"
      tagline="Type a sum, get the answer"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Calculation Input */}
        <SingleLineField
          id="calculator-expression"
          label="Calculation"
          value={expression}
          onChange={setExpression}
          placeholder="e.g. (12 + 8) * 3"
          hint="for example (12 + 8) * 3"
          maxLength={512}
          onClear={handleClear}
        />

        {/* Live Answer or Error display */}
        {result && result.ok && (
          <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Answer
            </span>
            <div className="font-mono text-3xl font-medium text-white tracking-tight break-all select-text">
              {result.formatted}
            </div>
          </div>
        )}

        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error, result.position)} />
        )}

        {!result && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic">
            Enter a sum above to see the calculation result.
          </div>
        )}

        {/* Buttons: Clear, Copy answer */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleClear}
            disabled={!expression}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 text-[#D0D2D6] text-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={15} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!result || !result.ok}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                <span>Copy answer</span>
              </>
            )}
          </button>
        </div>

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SegmentedChoice<'rad' | 'deg'>
            label="Trigonometric Angle Unit"
            choices={[
              { id: 'rad', label: 'Radians (rad)' },
              { id: 'deg', label: 'Degrees (deg)' },
            ]}
            value={angleUnit}
            onChange={setAngleUnit}
          />
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default CalculatorScreen;
