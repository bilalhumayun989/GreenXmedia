import React from 'react';

export const Switch = ({ checked, onCheckedChange, disabled = false }) => {
    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onCheckedChange?.(!checked)}
            className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${checked ? 'bg-primary' : 'bg-muted'}
            `}
        >
            <span
                className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${checked ? 'translate-x-6' : 'translate-x-1'}
                `}
            />
        </button>
    );
};
