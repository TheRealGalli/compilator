import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Inizializza il client Secret Manager di GCP
const client = new SecretManagerServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE, // Opzionale
});

const PROJECT_ID = process.env.GCP_PROJECT_ID || '';

/**
 * Recupera un segreto da Secret Manager
 */
export async function getSecret(secretName: string): Promise<string> {
  const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });

    if (!version.payload?.data) {
      throw new Error(`Secret ${secretName} not found or empty`);
    }

    // I dati possono essere Buffer o stringa
    const secretValue = version.payload.data.toString();
    return secretValue;
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Crea o aggiorna un segreto in Secret Manager
 */
export async function createOrUpdateSecret(
  secretName: string,
  secretValue: string,
): Promise<void> {
  const parent = `projects/${PROJECT_ID}`;

  try {
    // Verifica se il segreto esiste già
    try {
      await client.getSecret({ name: `${parent}/secrets/${secretName}` });

      // Il segreto esiste, aggiungi una nuova versione
      await client.addSecretVersion({
        parent: `${parent}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });
    } catch (error: any) {
      // Se il segreto non esiste, crealo
      if (error.code === 5) { // NOT_FOUND
        await client.createSecret({
          parent,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // Aggiungi la prima versione
        await client.addSecretVersion({
          parent: `${parent}/secrets/${secretName}`,
          payload: {
            data: Buffer.from(secretValue, 'utf8'),
          },
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`Error creating/updating secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Recupera la chiave API del modello (es. OpenAI, Google AI, ecc.)
 * Prima controlla le variabili d'ambiente, poi fallback su Secret Manager
 */
export async function getModelApiKey(modelProvider: string = 'openai'): Promise<string> {
  // Prova prima con variabili d'ambiente (per Cloud Run)
  const envVarName = `${modelProvider.toUpperCase()}_API_KEY`;
  const envValue = process.env[envVarName];

  if (envValue) {
    console.log(`Using ${envVarName} from environment variable`);
    return envValue;
  }

  // Fallback su Secret Manager (per compatibilità)
  const secretName = `MODEL_API_KEY_${modelProvider.toUpperCase()}`;
  console.log(`Trying to fetch ${secretName} from Secret Manager`);
  return getSecret(secretName);
}

