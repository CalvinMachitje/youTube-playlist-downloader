// This component renders a progress bar based on the given progress percentage.
// frontend/src/components/ProgressBar.tsx
type Props = {
  progress: string;
};

export default function ProgressBar({ progress }: Props) {
  const value = parseFloat(progress.replace("%", "")) || 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}