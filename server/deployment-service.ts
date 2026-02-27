import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class DeploymentService {
    private auth: any;

    constructor(accessToken: string) {
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
            } catch (error) {
                console.error(`[Deployment] Failed to enable ${serviceName}:`, error);
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
                    dir: '/',
                    revision: 'refs/heads/main'
                }
            }
        };

        console.log(`[Deployment] Starting Cloud Build for ${projectId}...`);
        const response = await cloudbuild.projects.builds.create({
            projectId,
            requestBody: build
        });

        return response.data.metadata?.build?.id;
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
