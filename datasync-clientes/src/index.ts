import axios from "axios";
import mysql from "mysql";
import oracledb from "oracledb";
import path from "path";
import { formatISO, parseISO } from "date-fns";

import "dotenv/config";

// Types
import { Customer } from "./types/Costumer";
import { Config } from "./types/Config";

// Configuração do Oracle Instant Client
const oracleClientPath = path.resolve(__dirname, "instantclient_19_25");
oracledb.initOracleClient({ libDir: oracleClientPath });

let timer: number = 3000;
let automatic: boolean = false;
let mainInterval: NodeJS.Timeout | null = null;

// Configurações do banco de dados
const dbConfig = {
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
};

// Conexão persistente com o banco de dados
let dbConnection: mysql.Connection;

var oracleConnection: oracledb.Connection;

async function initOracleClient() {
  // Conexão com o Oracle
  oracleConnection = await oracledb.getConnection({
    user: process.env.LCDBUSER,
    password: process.env.LCDBPASS,
    connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`,
  });
  console.log("Conectado ao OracleDB às " + formatISO(new Date()));
}

function updateCustomerConsolidSatusOK(
    customerId: number,
    callback: (error: Error | null) => void
  ): void {
    const query =
      "UPDATE clientes SET consolid = 1 WHERE id = ?";
    dbConnection.query(query, [customerId], (error) => {
      if (error) {
        return callback(error);
      }
      callback(null);
    });
  }

// Atualizar o cadastro do cliente no banco de dados!
async function updateCliente(
  Id: string,
  DtNascimento: string,
  ClienteId: number
): Promise<boolean> {
  try {
    // Verifica se a conexão está ativa; caso contrário, inicializa
    if (!oracleConnection || !oracleConnection.isHealthy) {
      console.warn(
        "Conexão com o Oracle não encontrada ou inativa. Tentando reconectar..."
      );
      await initOracleClient();
    }

    // Executa a query de atualização
    await oracleConnection.execute(
      `UPDATE PCCLIENT 
             SET TELCELENT = TELCOB, 
                 NUMCARTAOFIDELIDADE = CGCENT,
                 CGCENTREGA = CGCENT,
                 CONSUMIDORFINAL = CASE WHEN LENGTH(CGCENT) <= 11 THEN 'S' ELSE 'N' END,
                 DTNASC = TO_DATE(:DTNASCIMENTO, 'YYYY-MM-DD') 
             WHERE CODCLI = :CODCLI`,
      { DTNASCIMENTO: DtNascimento, CODCLI: Id }
    );

    // Confirma as alterações no banco
    await oracleConnection.commit();


    updateCustomerConsolidSatusOK(ClienteId, (updateError) => {
        if (updateError) {
          console.error(
            `Erro ao atualizar status de consolid do cliente ${ClienteId}: ${updateError}`
          );
        }else {
            console.log(`Consolidação de dados realizado com suceso para o cliente id: ${ClienteId}`);
        }
      });

    console.log(
      `Cliente com CODCLI ${Id} e DTNASC ${DtNascimento} atualizado com sucesso.`
    );

    return true;
  } catch (error) {
    console.error(`Erro ao atualizar o cliente com CODCLI ${Id}:`, error);
    return false;
  }
}

// Função para iniciar e manter a conexão com o banco de dados
function initializeDbConnection() {
  dbConnection = mysql.createConnection(dbConfig);
  dbConnection.connect((err) => {
    if (err) {
      console.error("Erro ao conectar com o banco de dados:", err);
      setTimeout(initializeDbConnection, 5000); // Tenta reconectar após 5 segundos
    } else {
      console.log("Conexão com o banco de dados estabelecida.");
    }
  });

  // Trata erros de conexão
  dbConnection.on("error", (err) => {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.warn(
        "Conexão com o banco de dados perdida. Tentando reconectar..."
      );
      initializeDbConnection(); // Reconecta
    } else {
      throw err;
    }
  });
}

// Configurações da API
const apiLoginUrl = `${process.env.API_TOTVS_URL}/winthor/autenticacao/v1/login`;
const apiCustomerUrl = `${process.env.API_TOTVS_URL}/api/wholesale/v1/customer/`;

const loginData = {
  login: process.env.USER,
  senha: process.env.PASSWORD,
};

let authToken: string | null = null;

// Função para obter configuração do sistema
function getConfigSystem(
  callback: (error: Error | null, configs: Config[] | null) => void
): void {
  const query = "SELECT * FROM config_cadastro_clientes";
  dbConnection.query(query, (error, results) => {
    if (error) {
      return callback(error, null);
    }
    const configs: Config[] = results.map((result: any) => ({
      timer: result.timer,
      automatic: result.automatic,
    }));

    callback(null, configs);
  });
}

// Função para obter o token de autenticação
async function getAuthToken(): Promise<string> {
  try {
    const response = await axios.post(apiLoginUrl, loginData);
    console.log(`Token gerado com sucesso: ${response.data.accessToken}`);
    return response.data.accessToken;
  } catch (error) {
    throw new Error(`Erro ao obter token: ${error}`);
  }
}

// Função para atualizar status de recusa do cliente
function updateCustomerRejectionStatus(
  customerId: number,
  recusedMsg: string,
  callback: (error: Error | null) => void
): void {
  const query =
    "UPDATE clientes SET recused = TRUE, recused_msg = ? WHERE id = ?";
  dbConnection.query(query, [recusedMsg, customerId], (error) => {
    if (error) {
      return callback(error);
    }
    callback(null);
  });
}

// Função para enviar dados do cliente para a API
async function sendCustomerData(
  token: string,
  customerData: any,
  customerId: number,
  DtNascimento: string,
  novo_ou_atualizado: number
): Promise<void> {
  let dataRecebida: Date;
  if (DtNascimento === "0000-00-00" || !DtNascimento || typeof DtNascimento !== 'string') {
    dataRecebida = new Date(2000, 1, 1);
  } else {
    dataRecebida = parseISO(DtNascimento);
  }
  const data_nascimento = formatISO(dataRecebida, { representation: "date" });
  console.log(data_nascimento);

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const { data } = await axios.post(apiCustomerUrl, customerData, {
      headers,
    });
    if (data) {
      let novo = 0;
      let atualizado = 0;
      if (novo_ou_atualizado > 0) {
        novo = 0;
        atualizado = 1;
      } else {
        novo = 1;
        atualizado = 0;
      }
      console.log(
        `Cliente de ID: ${data.Id} ${
          novo_ou_atualizado ? "Atualizar Cadastro" : "Realizar Novo Cadastro"
        }`
      );
      updateCliente(data.Id, data_nascimento, customerId,);
      updateCustomerRegistrationCodCli(
        customerId,
        String(data.Id),
        novo,
        atualizado,
        (updateError) => {
          if (updateError) {
            console.error(
              `Erro ao atualizar codcli do cliente ${customerId}: ${updateError}`
            );
          }
        }
      );
    }
  } catch (error: any) {
    if (error.response) {
      const recusedMsg = JSON.stringify(error.response.data);
      updateCustomerRejectionStatus(customerId, recusedMsg, (updateError) => {
        if (updateError) {
          console.error(
            `Erro ao atualizar status de recusa do cliente ${customerId}: ${updateError}`
          );
        }
      });
    } else {
      console.error(`Erro ao enviar dados do cliente ${customerId}: ${error}`);
    }
  }
}

// Função para obter clientes não registrados do banco de dados
function getUnregisteredCustomers(
  callback: (error: Error | null, customers: any[] | null) => void
): void {
  const query = `SELECT * FROM clientes WHERE registered = 0 ${
    automatic ? "" : "AND authorized = TRUE"
  }`;
  dbConnection.query(query, (error, results) => {
    if (error) {
      return callback(error, null);
    }
    callback(null, results);
  });
}

async function clienteExiste(CGCENT: string): Promise<number> {
  try {
    // Verifica se a conexão está ativa; caso contrário, inicializa
    if (!oracleConnection || !oracleConnection.isHealthy) {
      console.warn(
        "Conexão com o Oracle não encontrada ou inativa. Tentando reconectar..."
      );
      await initOracleClient();
    }

    // Executa a consulta para verificar se o cliente existe
    const result = await oracleConnection.execute(
      `SELECT COUNT(*) AS TOTAL FROM PCCLIENT WHERE CGCENT = :CGCENT`,
      { CGCENT },
      { outFormat: require("oracledb").OUT_FORMAT_OBJECT } // Retorna os resultados como objetos
    );

    // Verifica se há resultados e obtém o valor corretamente
    const total =
      result.rows && result.rows.length > 0
        ? (result.rows[0] as { TOTAL: number }).TOTAL
        : 0;

    // Retorna true se existir pelo menos um registro, senão false
    if (total > 0) {
      return 1;
    } else {
      return 0;
    }
  } catch (error) {
    console.error(`Erro ao verificar o cliente com CGCENT ${CGCENT}:`, error);
    return 0;
  }
}

// Função para atualizar o status de registro do cliente no banco de dados
function updateCustomerRegistrationStatus(
  customerId: number,
  callback: (error: Error | null) => void
): void {
  const query =
    "UPDATE clientes SET registered = TRUE, authorized = TRUE, recused = FALSE WHERE id = ?";
  dbConnection.query(query, [customerId], (error) => {
    if (error) {
      return callback(error);
    }
    callback(null);
  });
}

function updateCustomerRegistrationCodCli(
  customerId: number,
  codcli: string,
  novo: number,
  atualizado: number,
  callback: (error: Error | null) => void
): void {
  const query =
    "UPDATE clientes SET registered = TRUE, authorized = TRUE, recused = FALSE, recused_msg = NULL, novo = ?, atualizado = ?, codcli = ? WHERE id = ?";
  dbConnection.query(query, [novo, atualizado, codcli, customerId], (error) => {
    if (error) {
      return callback(error);
    }
    callback(null);
  });
}

// Verificar a consolidação de cadastros no sistema.
async function consolidCustomers(): Promise<any> {
  return new Promise((resolve, reject) => {
    const query =
      "SELECT * FROM clientes WHERE consolid = 0 AND recused_msg = null ORDER BY id DESC";

    dbConnection.query(query, (error, results) => {
      if (error) {
        console.error("Erro ao consolidar cadastros:", error);
        reject(error);
        return;
      }
      if (results.length > 0) {
        const clientes = results;
        clientes.forEach(async (customer: Customer, index: number) => {
          if (customer) {
            setTimeout(async () => {
              let novo_ou_atualizado;

              if (customer.novo) {
                novo_ou_atualizado = 0;
              } else {
                novo_ou_atualizado = 1;
              }

              console.log(
                `id: ${customer.id} - name: ${
                  customer.name.split(" ")[0]
                }`
              );

              console.log(`${novo_ou_atualizado ? 'Atualizado' : 'Novo'}`);

              const customerData = {
                corporate: customer.corporate,
                name: customer.name,
                tradeName: customer.trade_name,
                personIdentificationNumber: customer.person_identification_number,
                stateInscription: customer.state_inscription,
                commercialAddress: customer.commercial_address,
                commercialAddressNumber: customer.commercial_address_number,
                businessDistrict: customer.business_district,
                commercialZipCode: customer.commercial_zip_code,
                billingPhone: customer.billingPhone,
                email: customer.email,
                emailNfe: customer.email_nfe,
                customerOrigin: customer.customer_origin,
                finalCostumer: customer.final_customer,
                billingId: customer.billing_id,
                squareId: customer.square_id,
                activityId: customer.activity_id,
                businessCity: customer.business_city,
                sellerId: customer.seller_id,
                cityId: customer.city_id,
                countryId: customer.country_id,
                documentType: customer.document_type,
              };

              await sendCustomerData(
                authToken || "",
                customerData,
                customer.id,
                customer.data_nascimento ||
                  (customer.data_nascimento === "0000-00-00"
                    ? "2000-01-01T03:00:00Z"
                    : ""),
                novo_ou_atualizado
              );
            }, 10000 * index);
          }
        });
        resolve(clientes);
      }
    });
  });
}

// Função para iniciar o loop principal com a configuração atualizada
async function startMainLoop(): Promise<void> {
  if (mainInterval) {
    clearInterval(mainInterval);
  }

  mainInterval = setInterval(async () => {
    try {
      if (!authToken) {
        console.error("Token não disponível. Aguarde o próximo ciclo.");
        return;
      }

      getUnregisteredCustomers((error, customers) => {
        if (error) {
          throw new Error(`Erro ao obter clientes não registrados: ${error}`);
        }
        if (customers && customers.length) {
          customers.forEach(async (customer: Customer) => {
            const customerData = {
              corporate: customer.corporate,
              name: customer.name,
              tradeName: customer.trade_name,
              personIdentificationNumber: customer.person_identification_number,
              stateInscription: customer.state_inscription,
              commercialAddress: customer.commercial_address,
              commercialAddressNumber: customer.commercial_address_number,
              businessDistrict: customer.business_district,
              commercialZipCode: customer.commercial_zip_code,
              billingPhone: customer.billingPhone,
              email: customer.email,
              emailNfe: customer.email_nfe,
              customerOrigin: customer.customer_origin,
              finalCostumer: customer.final_customer,
              billingId: customer.billing_id,
              squareId: customer.square_id,
              activityId: customer.activity_id,
              businessCity: customer.business_city,
              sellerId: customer.seller_id,
              cityId: customer.city_id,
              countryId: customer.country_id,
              documentType: customer.document_type,
            };

            const novo_ou_atualizado = await clienteExiste(
              customer.person_identification_number
            );
            if (!novo_ou_atualizado) {
              console.log("Novo Cliente!");
            } else {
              console.log("Cliente Atualizado!");
            }
            await sendCustomerData(
              authToken || "",
              customerData,
              customer.id,
              customer.data_nascimento ||
                (customer.data_nascimento === "0000-00-00"
                  ? "2000-01-01T03:00:00Z"
                  : ""),
              novo_ou_atualizado
            );
            updateCustomerRegistrationStatus(customer.id, (updateError) => {
              if (updateError) {
                console.error(
                  `Erro ao atualizar status de registro do cliente ${customer.id}: ${updateError}`
                );
              }
            });
          });
          console.log("Registros foram enviados com sucesso.");
        }
      });
    } catch (error) {
      console.error(`Ocorreu um erro: ${error}`);
    }
  }, timer);
}

// Função principal
async function main(): Promise<void> {
  initializeDbConnection(); // Inicializa a conexão com o banco de dados

  try {
    authToken = await getAuthToken();
  } catch (error) {
    console.error(`Erro ao gerar token: ${error}`);
  }

  // Atualiza o token de autenticação a cada 30 minutos
  setInterval(async () => {
    try {
      authToken = await getAuthToken();
    } catch (error) {
      console.error(`Erro ao gerar token: ${error}`);
    }
  }, 30 * 60 * 1000);

  // Atualiza a configuração do sistema a cada 5 segundos
  setInterval(() => {
    getConfigSystem((err, result) => {
      if (result && Array.isArray(result) && result.length > 0) {
        if (timer !== result[0].timer || automatic !== result[0].automatic) {
          timer = result[0].timer;
          automatic = result[0].automatic;
          console.log(
            `Configuração atualizada: timer = ${timer}, automatic = ${automatic}`
          );
          startMainLoop();
        }
      } else {
        console.error("Falha ao obter configuração do sistema.");
      }
    });
  }, 5000);
}

main();

initOracleClient();

consolidCustomers();

setInterval(() => {
  initOracleClient();
}, 60000 * Number(process.env.INTERVAL_CONNECTION_ORACLEDB));

setInterval(() => {
  consolidCustomers();
}, 60000 * Number(process.env.INTERVAL_CONNECTION_ORACLEDB));
