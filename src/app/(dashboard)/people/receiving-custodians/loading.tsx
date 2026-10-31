export default function LoadingReceivingCustodians() {
  return <div role="status" aria-label="Loading receiving custodians" className="space-y-5 animate-pulse">
    <div className="h-24 rounded border border-[#EBD3B2] bg-white" />
    <div className="h-16 rounded border border-[#EBD3B2] bg-white" />
    {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 rounded bg-[#EBD3B2]/40" />)}
    <span className="sr-only">Loading receiving custodians…</span>
  </div>;
}
