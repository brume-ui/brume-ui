import {
  type Announcements,
  type DndContextProps,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { useBrume } from '../provider';

/**
 * Pointer dragging (after a 4px move, so a click stays a click) and, unless a component runs its
 * own keyboard mode, dnd-kit's keyboard sensor.
 */
export function useSortableSensors({ keyboard = true }: { keyboard?: boolean } = {}) {
  const all = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return useMemo(
    () => (keyboard ? all : all.filter((descriptor) => descriptor.sensor !== KeyboardSensor)),
    [all, keyboard],
  );
}

/**
 * The dnd-kit wiring shared by every sortable list: pointer + keyboard sensors and localized
 * screen reader announcements. `nameOf` / `positionOf` (1-based) take the string ids.
 */
export function useSortableSetup(
  nameOf: (id: string) => string,
  positionOf: (id: string) => number,
): Pick<DndContextProps, 'sensors' | 'accessibility'> {
  const { t } = useBrume();
  const sensors = useSortableSensors();
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
