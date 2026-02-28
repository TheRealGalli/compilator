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
            'artifactregistry.googleapis.com'
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

    async startBuild(projectId: string, repoUrl: string) {
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

        console.log(`[Deployment] Build ${buildId} started. Waiting for completion...`);
        await this.waitForBuild(cloudbuild, projectId, buildId);

        return buildId;
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

    async deployToCloudRun(projectId: string, serviceName: string, envVars: Record<string, string>) {
        const run = google.run({
            version: 'v1',
            auth: this.auth as any,
            rootUrl: 'https://europe-west1-run.googleapis.com'
        });

        const service = {
            apiVersion: 'serving.knative.dev/v1',
            kind: 'Service',
            metadata: {
                name: serviceName,
                namespace: projectId
            },
            spec: {
                template: {
                    spec: {
                        containers: [
                            {
                                image: `gcr.io/${projectId}/gromit-backend`,
                                env: Object.entries(envVars).map(([name, value]) => ({ name, value }))
                            }
                        ]
                    }
                }
            }
        };

        console.log(`[Deployment] Deploying ${serviceName} to Cloud Run in ${projectId}...`);
        const response = await run.namespaces.services.create({
            parent: `namespaces/${projectId}`,
            requestBody: service
        });

        return response.data;
    }
}
