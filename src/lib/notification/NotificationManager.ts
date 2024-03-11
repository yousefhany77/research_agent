export enum NotificationActor {
  SearchWorker = 'SearchWorker',
  ResearchManager = 'ResearchManager',
  QuestionGeneratorAgent = 'QuestionGeneratorAgent',
}
export type NotificationType =
  | `${NotificationActor}:${'Tool' | 'Task'}:${'Start' | 'End' | 'Error'}`
  | `${NotificationActor}:initialized`
  | `${NotificationActor}:done`;
export interface Notification<Payload = any> {
  message: string;
  payload?: Payload;
  createdAt: Date;
  createdBy: string;
  actor: NotificationActor;
  type: NotificationType;
}

class NotificationManager {
  private static instance: NotificationManager;
  private listeners = new Set<(notification: Notification) => void>();
  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public notify(notification: Notification): void {
    this.listeners.forEach((listener) => listener(notification));
  }
  public addListener(listener: (notification: Notification) => void): void {
    this.listeners.add(listener);
  }
}

export default NotificationManager.getInstance();
