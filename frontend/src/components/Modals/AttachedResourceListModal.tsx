import React from 'react';
import { Edit2, Trash2, Plus, LucideIcon } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

export interface BaseAttachedItem {
  id: string;
  name: string;
}

export interface AttachedResourceListModalProps<T extends BaseAttachedItem> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass?: string;
  buttonBgColorClass?: string;
  hoverIconColorClass?: string;
  items: T[];
  emptyText: string;
  addLabel: string;
  itemTypeName?: string;
  renderItemDetails: (item: T) => React.ReactNode;
  onEditItem: (item: T) => void;
  onDeleteItem: (itemId: string, itemName: string) => void;
  onAddNewItem: () => void;
}

export function AttachedResourceListModal<T extends BaseAttachedItem>({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColorClass = "text-indigo-400",
  buttonBgColorClass = "bg-indigo-600 hover:bg-indigo-500",
  hoverIconColorClass = "hover:text-indigo-300 hover:bg-indigo-500/10",
  items,
  emptyText,
  addLabel,
  itemTypeName,
  renderItemDetails,
  onEditItem,
  onDeleteItem,
  onAddNewItem,
}: AttachedResourceListModalProps<T>): React.ReactElement | null {
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onAddNewItem();
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm cursor-pointer",
          buttonBgColorClass
        )}
      >
        <Plus size={14} /> {addLabel}
      </button>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          colorMode === 'dark'
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Close
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={Icon}
      iconColorClass={iconColorClass}
      widthClass="w-full max-w-2xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">{emptyText}</div>
        ) : (
          items.map((item) => {
            const editTitle = itemTypeName ? `Edit ${itemTypeName}` : `Edit ${item.name}`;
            const deleteTitle = itemTypeName ? `Delete ${itemTypeName}` : `Delete ${item.name}`;

            return (
              <div
                key={`attached-modal-item-${item.id}`}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                  colorMode === 'dark'
                    ? "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={cn(iconColorClass, "shrink-0")} />
                    <span className={cn("font-mono font-bold text-xs truncate", iconColorClass)}>
                      {item.name}
                    </span>
                  </div>
                  {renderItemDetails(item)}
                </div>

                <div className="flex items-center gap-1 shrink-0 border-l pl-2 border-slate-700/40">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditItem(item);
                    }}
                    className={cn("p-1.5 rounded-lg text-slate-400 transition-colors cursor-pointer", hoverIconColorClass)}
                    title={editTitle}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id, item.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={deleteTitle}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
