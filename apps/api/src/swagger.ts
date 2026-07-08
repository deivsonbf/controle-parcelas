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
                      description: 'Quando ativo, soma despesas mensais e compras de todos os usuarios ativos marcados como conta conjunta.'
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
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'lastFour', 'ownerName', 'closingDay', 'dueDay'],
                  properties: {
                    name: { type: 'string', example: 'Nubank' },
                    lastFour: { type: 'string', example: '1111' },
                    ownerName: { type: 'string', example: 'Deivson' },
                    ownerUserId: { type: 'string', format: 'uuid', nullable: true },
                    imageUrl: { type: 'string', format: 'uri', nullable: true },
                    closingDay: { type: 'integer', example: 4 },
                    dueDay: { type: 'integer', example: 13 },
                    active: { type: 'boolean', example: true }
                  }
                }
              }
            }
          },
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
                    recurring: { type: 'boolean', example: false },
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
          summary: 'Lista despesas mensais; quando month e informado, retorna recorrentes ativas e nao recorrentes daquela competencia',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } }
          ],
          responses: { '200': { description: 'Lista de despesas mensais' } }
        },
        post: {
          tags: ['FixedExpenses'],
          summary: 'Cria despesa mensal pelo administrador',
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
                    recurring: { type: 'boolean', example: true },
                    active: { type: 'boolean', example: true },
                    userId: { type: 'string', format: 'uuid' },
                    categoryId: { type: 'string', format: 'uuid' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Despesa mensal criada' } }
        }
      },
      '/api/invoice-payments': {
        get: {
          tags: ['InvoicePayments'],
          summary: 'Lista pagamentos/adiantamentos da fatura',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
            { name: 'cardId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Lista de pagamentos da fatura' } }
        },
        post: {
          tags: ['InvoicePayments'],
          summary: 'Registra pagamento/adiantamento na fatura do cartao',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cardId', 'month', 'amount', 'paymentDate'],
                  properties: {
                    cardId: { type: 'string', format: 'uuid' },
                    month: { type: 'string', example: '2026-07' },
                    amount: { type: 'number', example: 250 },
                    paymentDate: { type: 'string', format: 'date', example: '2026-07-05' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Pagamento registrado' } }
        }
      },
      '/api/financial-control': {
        get: {
          tags: ['FinancialControl'],
          summary: 'Resumo mensal de renda, despesas e pagamentos',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Controle financeiro do mes' } }
        }
      },
      '/api/financial-control/incomes': {
        post: {
          tags: ['FinancialControl'],
          summary: 'Cadastra renda mensal',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'month', 'description', 'amount', 'receivedDate'],
                  properties: {
                    userId: { type: 'string', format: 'uuid' },
                    month: { type: 'string', example: '2026-07' },
                    description: { type: 'string', example: 'Salario' },
                    amount: { type: 'number', example: 5000 },
                    receivedDate: { type: 'string', format: 'date', example: '2026-07-05' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Renda cadastrada' } }
        }
      },
      '/api/financial-control/payments': {
        post: {
          tags: ['FinancialControl'],
          summary: 'Marca uma despesa/fatura como paga no mes',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['month', 'expenseKind', 'amount', 'paidDate'],
                  properties: {
                    month: { type: 'string', example: '2026-07' },
                    expenseKind: { type: 'string', enum: ['fixed_expense', 'card_invoice'] },
                    fixedExpenseId: { type: 'string', format: 'uuid', nullable: true },
                    cardId: { type: 'string', format: 'uuid', nullable: true },
                    amount: { type: 'number', example: 250 },
                    paidDate: { type: 'string', format: 'date', example: '2026-07-05' },
                    notes: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Pagamento marcado' } }
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
          summary: 'Resumo principal com despesas mensais e totais por cartao',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'cardId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Totais do dashboard principal' } }
        }
      },
      '/api/reports/installment-projection': {
        get: {
          tags: ['Reports'],
          summary: 'Projecao de parcelas por mes e categoria em janela de 13 meses',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'cardId', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Meses projetados com totais e categorias' } }
        }
      },
      '/api/reports/summary': {
        get: {
          tags: ['Reports'],
          summary: 'Resumo mensal por usuario em janela de 13 meses',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } }
          ],
          responses: { '200': { description: 'Totais agrupados por mes' } }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js']
});
