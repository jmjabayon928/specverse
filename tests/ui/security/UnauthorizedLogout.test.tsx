import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import UnauthorizedPage from "../../../src/app/unauthorized/page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("UnauthorizedPage logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  it("calls server logout then routes to /login", async () => {
    const user = userEvent.setup();
    render(<UnauthorizedPage />);

    await user.click(
      screen.getByRole("button", { name: /Logout and Return to Login/i }),
    );

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/backend/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});

