"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div role="alert" className="p-5"><p>Activity history could not be loaded.</p><button className="mt-3 underline" onClick={reset}>Retry</button></div>; }
