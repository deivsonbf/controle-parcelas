import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Card Installments API',
      version: '1.0.0',
      description: 'API para controle de compras parceladas no cartao de credito.'
    },
    tags: [
      { name: 'Auth' },
      { name: 'Users' },
      { name: 'Cards' },
      { name: 'Categories' },
      { name: 'Expenses' },
      { name: 'Reports' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Autentica usuario por e-mail e senha',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', example: 'admin@example.com' },
                    password: { type: 'string', example: 'Admin@123456' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Token JWT e dados do usuario' } }
        }
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Retorna o usuario autenticado',
          responses: { '200': { description: 'Usuario autenticado' } }
        }
      },
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'Lista usuarios cadastrados',
          responses: { '200': { description: 'Lista de usuarios' } }
        },
        post: {
          tags: ['Users'],
          summary: 'Cria usuario pelo administrador',
          responses: { '201': { description: 'Usuario criado' } }
        }
      },
      '/api/cards': {
        get: {
          tags: ['Cards'],
          summary: 'Lista cartoes',
          responses: { '200': { description: 'Lista de cartoes' } }
        },
        post: {
          tags: ['Cards'],
          summary: 'Cria cartao',
          responses: { '201': { description: 'Cartao criado' } }
        }
      },
      '/api/categories': {
        get: {
          tags: ['Categories'],
          summary: 'Lista categorias',
          responses: { '200': { description: 'Lista de categorias' } }
        },
        post: {
          tags: ['Categories'],
          summary: 'Cria categoria',
          responses: { '201': { description: 'Categoria criada' } }
        }
      },
      '/api/expenses': {
        get: {
          tags: ['Expenses'],
          summary: 'Lista compras; usuario comum ve somente as suas',
          responses: { '200': { description: 'Lista de compras' } }
        },
        post: {
          tags: ['Expenses'],
          summary: 'Cria compra parcelada',
          responses: { '201': { description: 'Compra criada' } }
        }
      },
      '/api/reports/monthly-installments': {
        get: {
          tags: ['Reports'],
          summary: 'Lista parcelas de um mes',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-01' } },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Parcelas e total do mes' } }
        }
      },
      '/api/reports/summary': {
        get: {
          tags: ['Reports'],
          summary: 'Resumo mensal por usuario',
          responses: { '200': { description: 'Totais agrupados por mes' } }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js']
});
