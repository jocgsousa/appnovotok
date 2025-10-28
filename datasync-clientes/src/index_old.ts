import axios from 'axios';
import mysql from 'mysql';
import 'dotenv/config';

// Types
import { Customer } from './types/Costumer';
import { Config } from './types/Config';

let timer: number = 3000;
let automatic: boolean = false;
let mainInterval: NodeJS.Timeout | null = null;

// Configurações do banco de dados
const dbConfig = {
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME
};

// Configurações da API
const apiLoginUrl = `${process.env.API_TOTVS_URL}/winthor/autenticacao/v1/login`;
const apiCustomerUrl = `${process.env.API_TOTVS_URL}/api/wholesale/v1/customer/`;

const loginData = {
    login: process.env.USER,
    senha: process.env.PASSWORD
};

let authToken: string | null = null;

// Função para obter configuração do sistema
function getConfigSystem(callback: (error: Error | null, configs: Config[] | null) => void): void {
    const connection = mysql.createConnection(dbConfig);
    connection.connect();
    const query = "SELECT * FROM config";
    connection.query(query, (error, results) => {
        connection.end();
        if (error) {
            return callback(error, null);
        }

        const configs: Config[] = results.map((result: any) => ({
            timer: result.timer,
            automatic: result.automatic
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
function updateCustomerRejectionStatus(customerId: number, recusedMsg: string, callback: (error: Error | null) => void): void {
    const connection = mysql.createConnection(dbConfig);
    connection.connect();
    const query = "UPDATE clientes SET recused = TRUE, recused_msg = ? WHERE id = ?";
    connection.query(query, [recusedMsg, customerId], (error) => {
        connection.end();
        if (error) {
            return callback(error);
        }
        callback(null);
    });
}

// Função para enviar dados do cliente para a API
async function sendCustomerData(token: string, customerData: any, customerId: number): Promise<void> {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        await axios.post(apiCustomerUrl, customerData, { headers });
    } catch (error: any) {
        if (error.response && error.response.status === 422) {
            const recusedMsg = JSON.stringify(error.response.data);
            updateCustomerRejectionStatus(customerId, recusedMsg, (updateError) => {
                if (updateError) {
                    console.error(`Erro ao atualizar status de recusa do cliente ${customerId}: ${updateError}`);
                }
            });
        } else {
            console.error(`Erro ao enviar dados do cliente ${customerId}: ${error}`);
        }
    }
}

// Função para obter clientes não registrados do banco de dados
function getUnregisteredCustomers(callback: (error: Error | null, customers: any[] | null) => void): void {
    const connection = mysql.createConnection(dbConfig);
    connection.connect();
    const query = `SELECT * FROM clientes WHERE registered = 0 ${automatic ? "" : "AND authorized = TRUE"}`;
    connection.query(query, (error, results) => {
        connection.end();
        if (error) {
            return callback(error, null);
        }
        callback(null, results);
    });
}

// Função para atualizar o status de registro do cliente no banco de dados
function updateCustomerRegistrationStatus(customerId: number, callback: (error: Error | null) => void): void {
    const connection = mysql.createConnection(dbConfig);
    connection.connect();
    const query = "UPDATE clientes SET registered = TRUE, authorized = TRUE WHERE id = ?";
    connection.query(query, [customerId], (error) => {
        connection.end();
        if (error) {
            return callback(error);
        }
        callback(null);
    });
}

// Função para iniciar o loop principal com a configuração atualizada
async function startMainLoop(): Promise<void> {
    if (mainInterval) {
        clearInterval(mainInterval);
    }

    mainInterval = setInterval(async () => {
        // console.log("Consultando: " + new Date());
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
                            documentType: customer.document_type
                        };

                        await sendCustomerData(authToken || '', customerData, customer.id);
                        updateCustomerRegistrationStatus(customer.id, (updateError) => {
                            if (updateError) {
                                console.error(`Erro ao atualizar status de registro do cliente ${customer.id}: ${updateError}`);
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
    try {
        authToken = await getAuthToken();
    } catch (error) {
        console.error(`Erro ao gerar token: ${error}`);
    }

    setInterval(async () => {
        try {
            authToken = await getAuthToken();
        } catch (error) {
            console.error(`Erro ao gerar token: ${error}`);
        }
    }, 30 * 60 * 1000);

    setInterval(() => {
        getConfigSystem((err, result) => {
            if (result && Array.isArray(result) && result.length > 0) {
                if (timer !== result[0].timer || automatic !== result[0].automatic) {
                    timer = result[0].timer;
                    automatic = result[0].automatic;
                    console.log(`Configuração atualizada: timer = ${timer}, automatic = ${automatic}`);
                    startMainLoop();
                }
            } else {
                console.error("Falha ao obter configuração do sistema.");
            }
        });
    }, 5000);
}

main();
