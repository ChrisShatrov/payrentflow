// Shared DocuSign service utilities
// This file contains helper functions for DocuSign API operations

interface DocuSignTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  account_id: string;
  account_name?: string;
}

interface DocuSignRecipient {
  email: string;
  name: string;
  role: string;
  clientUserId?: string; // Required for embedded signing
}

interface DocuSignTab {
  documentId: string;
  pageNumber: string;
  xPosition: string;
  yPosition: string;
  tabLabel: string;
}

// Decrypt token
async function decryptToken(encrypted: string, key: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt token");
  }
}

// Get and refresh DocuSign tokens for a landlord
export async function getDocuSignTokens(
  supabase: any,
  landlordId: string
): Promise<DocuSignTokens> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY") || 
    Deno.env.get("DOCUSIGN_INTEGRATION_KEY") || 
    "default-key-change-in-production";

  // Fetch integration
  console.log("Fetching DocuSign integration for landlord_id:", landlordId);
  const { data: integration, error } = await supabase
    .from("docusign_integrations")
    .select("*")
    .eq("landlord_id", landlordId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching DocuSign integration:", error);
    throw new Error(`Failed to check DocuSign connection: ${error.message}`);
  }

  if (!integration) {
    console.error("No DocuSign integration found for landlord_id:", landlordId);
    throw new Error("DocuSign not connected for this landlord. Please connect your DocuSign account in Settings.");
  }

  console.log("DocuSign integration found:", {
    account_id: integration.account_id,
    account_name: integration.account_name,
    expires_at: integration.expires_at
  });

  // Check if token needs refresh
  const expiresAt = new Date(integration.expires_at);
  const now = new Date();
  const needsRefresh = expiresAt <= new Date(now.getTime() + 5 * 60 * 1000); // Refresh 5 min before expiry

  if (needsRefresh) {
    // Refresh token
    const refreshToken = await decryptToken(integration.refresh_token_encrypted, encryptionKey);
    const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://demo.docusign.net";
    const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
    const secretKey = Deno.env.get("DOCUSIGN_SECRET_KEY");

    if (!integrationKey || !secretKey) {
      throw new Error("DocuSign credentials not configured");
    }

    const tokenUrl = `${baseUrl}/oauth/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);
      throw new Error("Failed to refresh DocuSign token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token: new_refresh_token, expires_in } = tokenData;

    // Encrypt new tokens
    const accessTokenEncrypted = await encryptToken(access_token, encryptionKey);
    const refreshTokenEncrypted = await encryptToken(new_refresh_token, encryptionKey);
    const newExpiresAt = new Date(Date.now() + (expires_in * 1000));

    // Update database
    await supabase
      .from("docusign_integrations")
      .update({
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("landlord_id", landlordId);

    return {
      access_token,
      refresh_token: new_refresh_token,
      expires_at: newExpiresAt,
      account_id: integration.account_id,
      account_name: integration.account_name,
    };
  }

  // Return existing tokens
  const accessToken = await decryptToken(integration.access_token_encrypted, encryptionKey);
  const refreshToken = await decryptToken(integration.refresh_token_encrypted, encryptionKey);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    account_id: integration.account_id,
    account_name: integration.account_name,
  };
}

// Encrypt token
async function encryptToken(token: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Create DocuSign envelope
export async function createEnvelope(
  supabase: any,
  landlordId: string,
  documentBase64: string,
  documentName: string,
  recipients: DocuSignRecipient[],
  emailSubject?: string,
  emailBlurb?: string
): Promise<string> {
  const tokens = await getDocuSignTokens(supabase, landlordId);
  const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://demo.docusign.net";

  // Create envelope definition
  const envelopeDefinition = {
    emailSubject: emailSubject || "Please sign this document",
    emailBlurb: emailBlurb || "Please review and sign the attached document.",
    documents: [
      {
        documentBase64: documentBase64,
        name: documentName,
        fileExtension: "pdf",
        documentId: "1",
      },
    ],
    recipients: {
      signers: recipients.map((recipient, index) => ({
        email: recipient.email,
        name: recipient.name,
        recipientId: String(index + 1),
        routingOrder: String(index + 1),
        roleName: recipient.role,
        clientUserId: recipient.clientUserId || undefined,
        tabs: recipient.role === "Signer" ? {
          signHereTabs: [
            {
              documentId: "1",
              pageNumber: "1",
              xPosition: "100",
              yPosition: "100",
              tabLabel: "SignHere",
            },
          ],
          initialHereTabs: [
            {
              documentId: "1",
              pageNumber: "1",
              xPosition: "100",
              yPosition: "150",
              tabLabel: "InitialHere",
            },
          ],
          dateSignedTabs: [
            {
              documentId: "1",
              pageNumber: "1",
              xPosition: "100",
              yPosition: "200",
              tabLabel: "DateSigned",
            },
          ],
        } : undefined,
      })),
    },
    status: "sent", // or "created" if you want to send later
  };

  // Create envelope
  const response = await fetch(
    `${baseUrl}/restapi/v2.1/accounts/${tokens.account_id}/envelopes`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeDefinition),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create envelope:", errorText);
    throw new Error(`Failed to create DocuSign envelope: ${errorText}`);
  }

  const result = await response.json();
  return result.envelopeId;
}

// Get embedded signing URL
export async function getEmbeddedSigningUrl(
  supabase: any,
  landlordId: string,
  envelopeId: string,
  recipientEmail: string,
  returnUrl: string
): Promise<string> {
  const tokens = await getDocuSignTokens(supabase, landlordId);
  const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://demo.docusign.net";

  // Get recipient view token
  const viewRequest = {
    returnUrl: returnUrl,
    authenticationMethod: "none",
    email: recipientEmail,
    userName: recipientEmail, // You might want to pass actual name
  };

  const response = await fetch(
    `${baseUrl}/restapi/v2.1/accounts/${tokens.account_id}/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(viewRequest),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to get recipient view:", errorText);
    throw new Error(`Failed to get embedded signing URL: ${errorText}`);
  }

  const result = await response.json();
  return result.url;
}

// Download completed document
export async function downloadCompletedDocument(
  supabase: any,
  landlordId: string,
  envelopeId: string
): Promise<Uint8Array> {
  const tokens = await getDocuSignTokens(supabase, landlordId);
  const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://demo.docusign.net";

  // Get document list
  const documentsResponse = await fetch(
    `${baseUrl}/restapi/v2.1/accounts/${tokens.account_id}/envelopes/${envelopeId}/documents/combined`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        "Accept": "application/pdf",
      },
    }
  );

  if (!documentsResponse.ok) {
    const errorText = await documentsResponse.text();
    console.error("Failed to download document:", errorText);
    throw new Error(`Failed to download document: ${errorText}`);
  }

  const pdfBuffer = await documentsResponse.arrayBuffer();
  return new Uint8Array(pdfBuffer);
}

// Verify webhook HMAC signature
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(payload);

    // DocuSign uses HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    // DocuSign sends signature as base64, compare directly
    return computedSignature === signature;
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}
