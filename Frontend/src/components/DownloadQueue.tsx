// This component displays the list of download tasks, showing their status and allowing updates.
// frontend/src/components/DownloadQueue.tsx
import DownloadItem from "./DownloadItem";
import { type DownloadTask } from "../types/types";

type Props = {
  tasks: DownloadTask[];
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadQueue({ tasks, updateTask }: Props) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-4">Download Queue</h2>

      {tasks.length === 0 && (
        <p className="text-gray-500">No downloads yet</p>
      )}

      {tasks.map((task) => (
        <DownloadItem
          key={task.id}
          task={task}
          updateTask={updateTask}
        />
      ))}
    </div>
  );
}