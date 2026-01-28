// src/app/login/page.tsx
'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    // ✅ Redirect logged-in users away from login page
    const checkSession = async () => {
      const res = await fetch("/api/backend/auth/session", {
        credentials: "include",
      });
      if (res.ok) router.push("/dashboard");
    };
    checkSession();
  }, [router]);

  if (!mounted) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear previous error

    try {
      const response = await fetch("/api/backend/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Invalid login. Please try again.");
        return;
      }

      // ✅ Optional: revalidate session if needed
      const sessionCheck = await fetch("/api/backend/auth/session", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
        credentials: "include",
      });

      if (!sessionCheck.ok) {
        setError("Session validation failed. Please try again.");
        router.replace("/login"); // 👈 Fixes double login issue
        return;
      }

      // ✅ Redirect to home on success
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Sign In
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and password to sign in!
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label>
              Email <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              placeholder="info@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute z-30 -translate-y-1/2 right-4 top-1/2 p-1 cursor-pointer 
                          bg-transparent border-none focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span className="fill-gray-500 dark:fill-gray-400">
                  {showPassword ? <EyeIcon /> : <EyeCloseIcon />}
                </span>
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={isChecked} onChange={setIsChecked} />
              <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                Keep me logged in
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Forgot password? Contact your administrator.
            </span>
          </div>
          <Button type="submit" className="w-full" size="sm">
            Sign in
          </Button>
        </form>
        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Don&apos;t have an account? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
