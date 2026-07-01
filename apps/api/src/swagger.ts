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
      { name: 'FixedExpenses' },
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
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'password'],
                  properties: {
                    name: { type: 'string', example: 'Jamilly' },
                    email: { type: 'string', example: 'jamilly@example.com' },
                    password: { type: 'string', example: 'Senha@123' },
                    role: { type: 'string', enum: ['admin', 'user'], example: 'user' },
                    active: { type: 'boolean', example: true },
                    cardBuyerOnly: {
                      type: 'boolean',
                      example: true,
                      description: 'Marca usuarios que compram no cartao, mas nao sao donos do cartao.'
                    },
                    jointAccount: {
                      type: 'boolean',
                      example: false,
                      description: 'Quando ativo, soma despesas fixas e compras de todos os usuarios ativos marcados como conta conjunta.'
                    }
                  }
                }
              }
            }
          },
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
          summary: 'Lista compras; usuario comum ve as suas ou o escopo de conta conjunta',
          responses: { '200': { description: 'Lista de compras' } }
        },
        post: {
          tags: ['Expenses'],
          summary: 'Cria compra parcelada',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['description', 'totalAmount', 'installments', 'purchaseDate', 'expenseType', 'userId', 'cardId', 'categoryId'],
                  properties: {
                    description: { type: 'string', example: 'Mercado' },
                    totalAmount: { type: 'number', example: 1832.64 },
                    installments: { type: 'integer', example: 12 },
                    purchaseDate: { type: 'string', format: 'date', example: '2025-07-26' },
                    expenseType: {
                      type: 'string',
                      enum: ['fixed', 'card', 'unplanned'],
                      example: 'card',
                      description: 'Tipo da despesa: fixed=fixa, card=cartoes, unplanned=nao planejada.'
                    },
                    userId: { type: 'string', format: 'uuid' },
                    cardId: { type: 'string', format: 'uuid' },
                    categoryId: { type: 'string', format: 'uuid' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Compra criada' } }
        }
      },
      '/api/fixed-expenses': {
        get: {
          tags: ['FixedExpenses'],
          summary: 'Lista despesas fixas; usuario comum ve as suas ou o escopo de conta conjunta',
          responses: { '200': { description: 'Lista de despesas fixas' } }
        },
        post: {
          tags: ['FixedExpenses'],
          summary: 'Cria despesa fixa pelo administrador',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['description', 'amount', 'dueDay', 'startsOn', 'userId', 'categoryId'],
                  properties: {
                    description: { type: 'string', example: 'Internet' },
                    amount: { type: 'number', example: 129.9 },
                    dueDay: { type: 'integer', minimum: 1, maximum: 31, example: 10 },
                    startsOn: { type: 'string', format: 'date', example: '2026-07-01' },
                    active: { type: 'boolean', example: true },
                    userId: { type: 'string', format: 'uuid' },
                    categoryId: { type: 'string', format: 'uuid' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Despesa fixa criada' } }
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
      '/api/reports/dashboard': {
        get: {
          tags: ['Reports'],
          summary: 'Resumo principal com despesas fixas e totais por cartao',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'cardId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Totais do dashboard principal' } }
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
