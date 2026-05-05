"use client";

export function ProcessingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-24">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
        <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-800">
          Reading your transactions...
        </p>
        <p className="text-sm text-gray-400 mt-1">
          This usually takes a few seconds
        </p>
      </div>
    </div>
  );
}
