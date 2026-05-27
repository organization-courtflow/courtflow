"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

type PasswordFieldProps = {
  id: string;
  autoComplete: string;
  minLength?: number;
};

export default function PasswordField({
  id,
  autoComplete,
  minLength,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ToggleIcon = isVisible ? EyeOff : Eye;

  return (
    <div className="field auth-field password-field">
      <label htmlFor={id}>비밀번호</label>
      <Lock size={18} aria-hidden="true" />
      <input
        id={id}
        name="password"
        type={isVisible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
      >
        <ToggleIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
