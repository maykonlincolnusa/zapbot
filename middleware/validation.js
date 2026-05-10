const { z } = require('zod');

function validationError(error) {
  const normalized = new Error('Payload invalido');
  normalized.status = 400;
  normalized.code = 'VALIDATION_ERROR';
  normalized.details = error.issues?.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  })) || [];
  return normalized;
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) return next(validationError(result.error));
    req.body = result.data;
    next();
  };
}

const schemas = {
  authRegister: z.object({
    name: z.string().trim().min(1, 'Nome e obrigatorio'),
    email: z.string().trim().email('E-mail invalido'),
    password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
    company: z.string().trim().optional(),
    workspaceName: z.string().trim().optional(),
    remember: z.boolean().optional()
  }),
  authLogin: z.object({
    email: z.string().trim().email('E-mail invalido'),
    password: z.string().min(1, 'Senha e obrigatoria'),
    workspaceSlug: z.string().trim().optional()
  }),
  contactCreate: z.object({
    name: z.string().trim().optional(),
    phone: z.string().trim().min(6, 'Telefone e obrigatorio'),
    email: z.string().trim().email('E-mail invalido').optional().or(z.literal('')),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }),
  contactUpdate: z.object({
    name: z.string().trim().optional(),
    phone: z.string().trim().min(6, 'Telefone invalido').optional(),
    email: z.string().trim().email('E-mail invalido').optional().or(z.literal('')),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    status: z.string().trim().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }),
  integrationServer: z.object({
    name: z.string().trim().min(1, 'Nome e obrigatorio'),
    provider: z.string().trim().optional(),
    endpointUrl: z.string().trim().url('Endpoint invalido'),
    authType: z.enum(['bearer', 'api_key', 'basic', 'none']).optional(),
    authToken: z.string().optional().nullable(),
    eventMappings: z.array(z.any()).optional(),
    active: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
};

module.exports = {
  schemas,
  validateBody
};
