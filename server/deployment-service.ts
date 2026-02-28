
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class DeploymentService {
    private auth: any;
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
        this.auth = new google.auth.OAuth2();
        this.auth.setCredentials({ access_token: accessToken });
    }

    async enableApis(projectId: string) {
        const serviceusage = google.serviceusage({ version: 'v1', auth: this.auth as any });
        const apis = [
            'run.googleapis.com',
            'cloudbuild.googleapis.com',
            'artifactregistry.googleapis.com',
            'iam.googleapis.com'
        ];

        console.log(`[Deployment] Enabling APIs for project ${projectId}...`);
        for (const serviceName of apis) {
            try {
                await serviceusage.services.enable({
                    name: `projects/${projectId}/services/${serviceName}`
                });
                console.log(`[Deployment] API ${serviceName} enabled.`);
            } catch (error: any) {
                console.error(`[Deployment] Failed to enable ${serviceName}:`, error);

                // Intercept Billing Error specifically
                if (error.message?.includes('Billing account') && error.message?.includes('is not found')) {
                    throw new Error(`Fatturazione non abilitata sul progetto '${projectId}'. Per abilitare le API Serverless necessarie, devi collegare un account di fatturazione (Billing Account) al tuo progetto dalla Google Cloud Console.`);
                }

                throw error;
            }
        }
    }

    async startBuild(projectId: string, repoUrl: string, wait: boolean = true) {
        const cloudbuild = google.cloudbuild({ version: 'v1', auth: this.auth as any });

        // We target a specific branch (main) for the build
        const build = {
            steps: [
                {
                    name: 'gcr.io/cloud-builders/docker',
                    args: ['build', '-t', `gcr.io/${projectId}/gromit-backend`, '.']
                },
                {
                    name: 'gcr.io/cloud-builders/docker',
                    args: ['push', `gcr.io/${projectId}/gromit-backend`]
                }
            ],
            source: {
                gitSource: {
                    url: repoUrl,
                    revision: 'refs/heads/main'
                }
            }
        };

        console.log(`[Deployment] Starting Cloud Build for ${projectId}...`);
        const response = await cloudbuild.projects.builds.create({
            projectId,
            requestBody: build
        });

        const buildId = response.data.metadata?.build?.id;
        if (!buildId) {
            throw new Error('Failed to start Cloud Build: No build ID returned.');
        }

        console.log(`[Deployment] Build ${buildId} started. Wait=${wait}`);

        if (wait) {
            await this.waitForBuild(cloudbuild, projectId, buildId);
        }

        return buildId;
    }

    async checkBuildStatus(projectId: string, buildId: string) {
        const cloudbuild = google.cloudbuild({ version: 'v1', auth: this.auth as any });
        const response = await cloudbuild.projects.builds.get({
            projectId,
            id: buildId
        });
        return response.data.status;
    }

    private async waitForBuild(cloudbuild: any, projectId: string, buildId: string) {
        return new Promise<void>((resolve, reject) => {
            const checkStatus = async () => {
                try {
                    const response = await cloudbuild.projects.builds.get({
                        projectId,
                        id: buildId
                    });

                    const status = response.data.status;
                    console.log(`[Deployment] Build ${buildId} status: ${status}`);

                    if (status === 'SUCCESS') {
                        resolve();
                    } else if (['FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'].includes(status)) {
                        reject(new Error(`Cloud Build fallita con stato: ${status}`));
                    } else {
                        // Still running, check again in 10 seconds
                        setTimeout(checkStatus, 10000);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            // Start polling
            setTimeout(checkStatus, 10000);
        });
    }

    async startCloudRunDeploy(projectId: string, serviceName: string, envVars: Record<string, string>) {
        const run = google.run({ version: 'v2', auth: this.auth as any });
        const location = 'europe-west1';
        const parent = `projects/${projectId}/locations/${location}`;
        const servicePath = `${parent}/services/${serviceName}`;

        const serviceBody = {
            template: {
                containers: [{
                    image: `gcr.io/${projectId}/gromit-backend`,
                    env: Object.entries(envVars).map(([name, value]) => ({ name, value }))
                }]
            }
        };

        console.log(`[Deployment] Starting Cloud Run deployment for ${serviceName} in ${projectId} via v2 API...`);

        let operationName = '';

        try {
            const createResponse = await run.projects.locations.services.create({
                parent,
                serviceId: serviceName,
                requestBody: serviceBody
            });
            operationName = createResponse.data.name!;
            console.log(`[Deployment] Create operation started: ${operationName}`);
        } catch (error: any) {
            if (error.code === 409 || (error.message && error.message.includes('already exists'))) {
                console.log(`[Deployment] Service ${serviceName} exists, patching update instead...`);
                // Cloud Run v2 requires patching existing services instead of creating
                const patchResponse = await run.projects.locations.services.patch({
                    name: servicePath,
                    requestBody: serviceBody
                });
                operationName = patchResponse.data.name!;
                console.log(`[Deployment] Patch operation started: ${operationName}`);
            } else {
                console.error(`[Deployment] Create failed:`, error);
                throw error;
            }
        }

        return { operationName, servicePath };
    }

    async checkRunOperationStatus(operationName: string, servicePath: string) {
        const run = google.run({ version: 'v2', auth: this.auth as any });
        const op = await run.projects.locations.operations.get({ name: operationName });

        if (op.data.done) {
            if (op.data.error) {
                throw new Error(op.data.error.message || 'Error in Cloud Run operation');
            } else {
                // Fetch the service to get the final URL
                const service = await run.projects.locations.services.get({ name: servicePath });
                return { done: true, serviceUrl: service.data.uri };
            }
        } else {
            return { done: false, serviceUrl: null };
        }
    }

    async allowPublicAccess(projectId: string, serviceName: string) {
        const run = google.run({ version: 'v2', auth: this.auth as any });
        const resource = `projects/${projectId}/locations/europe-west1/services/${serviceName}`;

        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 4000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Deployment] Setting IAM policy for public access on ${serviceName} (attempt ${attempt}/${MAX_RETRIES})...`);
                await run.projects.locations.services.setIamPolicy({
                    resource,
                    requestBody: {
                        policy: {
                            bindings: [{
                                role: 'roles/run.invoker',
                                members: ['allUsers']
                            }]
                        }
                    }
                });

                // Verify the policy was actually set
                const currentPolicy = await run.projects.locations.services.getIamPolicy({ resource });
                const bindings = currentPolicy.data.bindings || [];
                const hasPublicAccess = bindings.some((b: any) =>
                    b.role === 'roles/run.invoker' && b.members?.includes('allUsers')
                );

                if (hasPublicAccess) {
                    console.log(`[Deployment] Public access VERIFIED for ${serviceName}.`);
                    return;
                } else {
                    console.warn(`[Deployment] IAM policy set but verification failed (attempt ${attempt}). Retrying...`);
                }
            } catch (error: any) {
                console.error(`[Deployment] IAM attempt ${attempt} failed:`, error.message);
                if (attempt === MAX_RETRIES) {
                    throw new Error(`Impossibile impostare l'accesso pubblico al servizio dopo ${MAX_RETRIES} tentativi: ${error.message}`);
                }
            }
            // Wait before retrying
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
    }
}
