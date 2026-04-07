// frontend/src/components/DownloadQueue.tsx
import DownloadItem from "./DownloadItem";
import { type DownloadTask } from "../types/types";

type Props = {
  tasks: DownloadTask[];
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadQueue({ tasks, updateTask }: Props) {
  // Active tasks (still running)
  const activeTasks = tasks.filter(t => 
    ["queued", "downloading", "processing", "cancelling", "zipping"].includes(t.status)
  );

  // Completed tasks (user can still download ZIP)
  const completedTasks = tasks.filter(t => 
    ["done", "error", "cancelled"].includes(t.status)
  );

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
          Download Queue
          <span className="text-sm font-normal text-gray-500">
            ({tasks.length} total)
          </span>
        </h2>

        {tasks.length > 0 && (
          <div className="flex gap-3 text-sm">
            <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
              In Progress: {activeTasks.length}
            </span>
            <span className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
              Completed: {completedTasks.length}
            </span>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-20 bg-white/70 backdrop-blur-sm rounded-3xl border border-orange-100 shadow-sm">
          <div className="mx-auto w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-5xl opacity-50">📥</span>
          </div>
          <p className="text-xl text-gray-600">No downloads yet</p>
          <p className="text-gray-500 mt-2">Paste YouTube playlist links above to begin</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active / In Progress */}
          {activeTasks.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center gap-2">
                ⏳ In Progress ({activeTasks.length})
              </h3>
              <div className="space-y-6">
                {activeTasks.map((task) => (
                  <DownloadItem
                    key={task.id}
                    task={task}
                    updateTask={updateTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center gap-2">
                Completed ({completedTasks.length})
              </h3>
              <div className="space-y-6">
                {completedTasks.map((task) => (
                  <DownloadItem
                    key={task.id}
                    task={task}
                    updateTask={updateTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}