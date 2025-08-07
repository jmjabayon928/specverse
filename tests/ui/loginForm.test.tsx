// tests/ui/loginForm.test.tsx
import { render, screen } from "@testing-library/react";
import SignInFormBase from "../../src/components/auth/SignInFormBase";

describe("SignInFormBase", () => {
  it("renders sign in form fields", () => {
    render(<SignInFormBase />);

    expect(screen.getByPlaceholderText(/info@gmail.com/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your password/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });
});