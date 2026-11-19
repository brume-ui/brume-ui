import {
  type Announcements,
  type DndContextProps,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBrume } from '../provider';

/**
 * The dnd-kit wiring shared by every sortable list: pointer + keyboard sensors and localized
 * screen reader announcements. `nameOf` / `positionOf` (1-based) take the string ids.
 */
export function useSortableSetup(
  nameOf: (id: string) => string,
  positionOf: (id: string) => number,
): Pick<DndContextProps, 'sensors' | 'accessibility'> {
  const { t } = useBrume();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dataTable.dragPickedUp', { label: nameOf(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('dataTable.dragMoved', {
            label: nameOf(String(active.id)),
            n: positionOf(String(over.id)),
          })
        : undefined,
    onDragEnd: () => t('dataTable.dragDropped'),
    onDragCancel: () => t('dataTable.dragCancelled'),
  };
  return {
    sensors,
    accessibility: {
      announcements,
      screenReaderInstructions: { draggable: t('dataTable.dragInstructions') },
    },
  };
}
