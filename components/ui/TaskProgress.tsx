'use client';

import { Check, Circle, Loader2 } from 'lucide-react';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
}

interface TaskProgressProps {
  tasks: Task[];
  className?: string;
}

export function TaskProgress({ tasks, className = '' }: TaskProgressProps) {
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progress = (completedCount / tasks.length) * 100;

  return (
    <div className={`bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 ${className}`}>
      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">Progress</span>
        <span className="text-xs text-slate-500">
          {completedCount}/{tasks.length}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Task List */}
      <div className="flex flex-wrap gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
              task.status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400'
                : task.status === 'in_progress'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-700/30 text-slate-500'
            }`}
          >
            {task.status === 'completed' && <Check className="w-3 h-3" />}
            {task.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
            {task.status === 'pending' && <Circle className="w-3 h-3" />}
            <span className={task.status === 'completed' ? 'line-through opacity-70' : ''}>
              {task.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TaskProgress;
