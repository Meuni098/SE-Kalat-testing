export function escapeLabelText(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Wait for every QR image before printing; leave the window available for reprinting. */
export function finishLabelPrint(printWindow: Window): void {
  printWindow.document.close();
  const images = Array.from(printWindow.document.images);
  Promise.all(images.map(img => img.decode())).then(() => {
    if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
  }).catch(() => {
    const message = printWindow.document.createElement("p");
    message.textContent = "A QR image could not be loaded. Close this window and retry printing.";
    printWindow.document.body.prepend(message);
  });
}
