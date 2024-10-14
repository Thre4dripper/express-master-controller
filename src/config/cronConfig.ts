import MasterController from '../MasterController';
import asyncHandler from '../AsyncHandler';
import { CronJob } from 'cron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isRequireSupported } from '../utils';

class CronConfig {
    /**
     * @description Method to initialize the cron jobs
     * @param dir - The directory to search for cron jobs
     */
    static InitCronJobs = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await CronConfig.InitCronJobs(fullPath);
            } else if (
                entry.isFile() &&
                (entry.name.endsWith('.cron.ts') || entry.name.endsWith('.cron.js'))
            ) {
                // require(fullPath);
                if (isRequireSupported()) {
                    require(fullPath);
                } else {
                    const fileUrl = new URL('file:///' + fullPath);
                    await import(fileUrl.href);
                }
            }
        }
    };

    /**
     * @description Method to start the cron jobs for the registered crons
     */
    static startCronJobs = () => {
        MasterController.getCronRequests().forEach((client) => {
            asyncHandler(
                (async () => {
                    const cron = new CronJob(client.cronPattern, () => {
                        client.masterController.cronController();
                    });
                    cron.start();
                })(),
            );
        });
    };
}

export default CronConfig;
