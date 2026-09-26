import { notifications } from '@mantine/notifications'
import { openFile } from './open-file'

/** Opens a file and reports errors/warnings as notifications. */
export async function openAndNotify(file: File): Promise<void> {
  const result = await openFile(file)
  if (result.status === 'error') {
    notifications.show({ color: 'red', title: 'Не удалось открыть файл', message: result.message })
  } else if (result.status === 'opened' && result.warning) {
    notifications.show({ color: 'yellow', title: 'Внимание', message: result.warning })
  }
}
