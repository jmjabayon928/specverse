export {};

declare global {
  interface Window {
    __SECURE_PAGE_PRESENT__?: boolean;
  }
}
