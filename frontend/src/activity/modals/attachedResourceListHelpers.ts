export interface BaseAttachedItem {
  id: string;
  name: string;
}

export const getItemActionTitles = (item: BaseAttachedItem, itemTypeName?: string) => {
  const editTitle = itemTypeName ? `Edit ${itemTypeName}` : `Edit ${item.name}`;
  const deleteTitle = itemTypeName ? `Delete ${itemTypeName}` : `Delete ${item.name}`;
  return { editTitle, deleteTitle };
};
