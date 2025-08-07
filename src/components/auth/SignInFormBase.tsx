// src/components/auth/SignInFormBase.tsx
import React, { useState } from "react";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeIcon, EyeCloseIcon } from "@/icons";

export default function SignInFormBase() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  return (
    <form>
      <div className="space-y-6">
        <div>
          <Label>
            Email <span className="text-error-500">*</span>
          </Label>
          <Input placeholder="info@gmail.com" type="email" />
        </div>
        <div>
          <Label>
            Password <span className="text-error-500">*</span>
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
            >
              {showPassword ? (
                <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
              ) : (
                <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox checked={isChecked} onChange={setIsChecked} />
          <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
            Keep me logged in
          </span>
        </div>
        <div>
          <Button className="w-full" size="sm">
            Sign in
          </Button>
        </div>
      </div>
    </form>
  );
}
