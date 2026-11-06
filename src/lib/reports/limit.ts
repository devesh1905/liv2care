/**
 * The largest report the app accepts. Vercel refuses any request body over 4.5 MB before our code runs, and the page then
 * shows the error screen, so the limit sits safely under that (the form adds a little on top of the file itself).
 */
export const MAX_REPORT_BYTES = 4 * 1024 * 1024;

/**
 * For a file input's onChange: marks a file over the limit as invalid, so the browser stops the form and shows the
 * message instead of sending a request that Vercel would refuse.
 */
export function limitReportSize(message: string) {
  return (e: { currentTarget: HTMLInputElement }) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.setCustomValidity(file && file.size > MAX_REPORT_BYTES ? message : "");
    input.reportValidity();
  };
}
