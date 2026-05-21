import { ConsoleLogger, Injectable } from '@nestjs/common';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class CloudWatchLogger extends ConsoleLogger {
  private client?: CloudWatchLogsClient;
  private readonly logGroupName = 'holocron-sentinel-logs';
  private readonly logStreamName = 'backend-stream';
  private isInitialized = false;
  private isInitializing = false;
  private queue: Array<{ timestamp: number; message: string }> = [];
  private isFlushing = false;
  private flushInterval?: NodeJS.Timeout;

  constructor() {
    super();
    const endpoint = process.env.AWS_CLOUDWATCH_ENDPOINT;
    if (endpoint) {
      this.client = new CloudWatchLogsClient({
        endpoint,
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      });
      void this.initializeCloudWatch();
      this.flushInterval = setInterval(() => {
        void this.flushQueue();
      }, 2000);
    }
  }

  private async initializeCloudWatch() {
    if (!this.client || this.isInitializing || this.isInitialized) return;

    this.isInitializing = true;
    try {
      try {
        await this.client.send(
          new CreateLogGroupCommand({ logGroupName: this.logGroupName }),
        );
      } catch (err) {
        const errorName =
          err && typeof err === 'object' && 'name' in err
            ? (err as { name: unknown }).name
            : undefined;
        if (errorName !== 'ResourceAlreadyExistsException') {
          console.error('Failed to create CloudWatch log group:', err);
          this.isInitializing = false;
          return;
        }
      }

      try {
        await this.client.send(
          new CreateLogStreamCommand({
            logGroupName: this.logGroupName,
            logStreamName: this.logStreamName,
          }),
        );
      } catch (err) {
        const errorName =
          err && typeof err === 'object' && 'name' in err
            ? (err as { name: unknown }).name
            : undefined;
        if (errorName !== 'ResourceAlreadyExistsException') {
          console.error('Failed to create CloudWatch log stream:', err);
          this.isInitializing = false;
          return;
        }
      }

      this.isInitialized = true;
      this.isInitializing = false;
      await this.flushQueue();
    } catch (err) {
      console.error('Error initializing CloudWatch logger:', err);
      this.isInitializing = false;
    }
  }

  private queueLog(level: string, message: unknown, context?: string) {
    if (!this.client) return;

    const timestamp = Date.now();
    const messageStr =
      typeof message === 'string'
        ? message
        : typeof message === 'object' && message !== null
          ? JSON.stringify(message)
          : String(message);

    const logMessage = JSON.stringify({
      level,
      timestamp: new Date(timestamp).toISOString(),
      context: context || this.context,
      message: messageStr,
    });

    this.queue.push({
      timestamp,
      message: logMessage,
    });

    if (this.queue.length >= 50) {
      void this.flushQueue();
    }
  }

  private async flushQueue() {
    if (
      !this.isInitialized ||
      !this.client ||
      this.queue.length === 0 ||
      this.isFlushing
    ) {
      return;
    }

    this.isFlushing = true;
    const eventsToSend = [...this.queue];
    this.queue = this.queue.slice(eventsToSend.length);

    try {
      await this.client.send(
        new PutLogEventsCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          logEvents: eventsToSend,
        }),
      );
    } catch (err) {
      console.error('Failed to flush logs to CloudWatch:', err);
      this.queue.unshift(...eventsToSend);
    } finally {
      this.isFlushing = false;
    }
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.queueLog('INFO', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    this.queueLog(
      'ERROR',
      `${message}${stack ? ` - Stack: ${stack}` : ''}`,
      context,
    );
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.queueLog('WARN', message, context);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.queueLog('DEBUG', message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.queueLog('VERBOSE', message, context);
  }

  onApplicationShutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
