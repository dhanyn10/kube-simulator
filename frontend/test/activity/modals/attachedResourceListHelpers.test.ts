import { describe, it, expect } from 'vitest';
import { getItemActionTitles } from '../../../src/activity/modals/attachedResourceListHelpers';

describe('attachedResourceListHelpers', () => {
  it('getItemActionTitles formats titles based on item or itemTypeName', () => {
    const defaultTitles = getItemActionTitles({ id: '1', name: 'my-res' });
    expect(defaultTitles.editTitle).toBe('Edit my-res');
    expect(defaultTitles.deleteTitle).toBe('Delete my-res');

    const customTitles = getItemActionTitles({ id: '1', name: 'my-res' }, 'Custom Resource');
    expect(customTitles.editTitle).toBe('Edit Custom Resource');
    expect(customTitles.deleteTitle).toBe('Delete Custom Resource');
  });
});
