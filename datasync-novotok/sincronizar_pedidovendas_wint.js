// Sincronizador de Pedidos de Vendas e Produtos (Oracle -> MySQL)
// Executa para o dia atual e o dia anterior

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const oracledb = require('oracledb');
const { pedidosVendasAPI, initializeAuth } = require('./api-client');
const moment = require('moment');

// Configura Oracle para retornar objetado
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.DATE];

function initOracleClient() {
  try {
    const clientLibPath = process.env.ORACLE_CLIENT_LIB_PATH || path.join(__dirname, 'instantclient_19_25');
    if (!fs.existsSync(clientLibPath)) {
      console.warn(`Aviso: ORACLE_CLIENT_LIB_PATH não encontrado em '${clientLibPath}'. Defina no .env o caminho do Instant Client (ex.: C\\instantclient_19_23).`);
    }
    oracledb.initOracleClient({ libDir: clientLibPath });
  } catch (err) {
    console.warn('Aviso: initOracleClient falhou, tentando seguir com client já carregado:', err.message);
  }
}

function normalizeCodigoFilial(codigo) {
  if (codigo === null || codigo === undefined) return null;
  return String(codigo).trim().replace(/^0+/, '');
}

function toNumberSafe(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Formata datas para logs de diagnóstico, aceitando Date ou string
function formatDateForLog(v) {
  if (!v) return '(vazio)';
  const m = parseDateFlexible(v);
  return m ? m.format('YYYY-MM-DD HH:mm:ss') : String(v);
}

function parseDateFlexible(v) {
  if (!v) return null;
  const formats = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD',
    'DD/MM/YYYY HH:mm:ss',
    'DD/MM/YYYY',
    'DD/MM/YY HH:mm:ss',
    'DD/MM/YY'
  ];
  for (const f of formats) {
    const m = moment(v, f, true);
    if (m.isValid()) return m;
  }
  const m = moment(v);
  return m.isValid() ? m : null;
}

function formatDateISODate(v) {
  const m = parseDateFlexible(v);
  return m ? m.format('YYYY-MM-DD') : null;
}

function formatDateISODateTime(v) {
  const m = parseDateFlexible(v);
  return m ? m.format('YYYY-MM-DD HH:mm:ss') : null;
}

// Removido acesso direto ao MySQL – vamos usar API

async function getOracle() {
  // Suporte a dois padrões de variáveis de ambiente:
  // 1) ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING
  // 2) LCDBUSER/LCDBPASS/LCDBHOST + LCDBNAME (padrão já usado no projeto)
  let user = process.env.ORACLE_USER || process.env.LCDBUSER;
  let password = process.env.ORACLE_PASSWORD || process.env.LCDBPASS;
  let connectString = process.env.ORACLE_CONNECT_STRING;

  if (!connectString) {
    const host = process.env.LCDBHOST;
    const dbname = process.env.LCDBNAME;
    if (host && dbname) {
      connectString = `${host}/${dbname}`;
    }
  }

  if (!user || !password || !connectString) {
    throw new Error('Variáveis Oracle ausentes. Defina ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING ou LCDBUSER/LCDBPASS/LCDBHOST/LCDBNAME no .env');
  }

  return await oracledb.getConnection({ user, password, connectString });
}

async function listarFiliaisMySQL(conn) {
  try {
    // Alguns ambientes não possuem coluna 'ativo'. Buscar todas as filiais cadastradas.
    const [rows] = await conn.execute('SELECT codigo FROM filiais');
    const codigos = rows.map(r => normalizeCodigoFilial(r.codigo)).filter(Boolean);
    return codigos;
  } catch (e) {
    console.warn('Aviso: não foi possível listar filiais no MySQL, usando todas as filiais.', e.message);
    return [];
  }
}

function buildFiliaisCSV(codigos) {
  if (!codigos || codigos.length === 0) return null;
  return codigos.join(',');
}

// Consulta de Pedidos (exatamente como no arquivo pedido_vendas_e_produtos.txt)
const PEDIDOS_SQL = `
SELECT PCPEDC.NUMPED, NVL(PCPEDC.RECARGA,'N') RECARGA, PCPEDC.DTENTREGA, 
 CAST((                                                           
   CASE WHEN LENGTH(PCPEDC.DTFAT) > 0 THEN                       
     ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' || 
     LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||          
     LEAST(NVL(PCPEDC.minutofat, '00'), 59) || ':00',        
     'dd/mm/yyyy hh24:mi:ss') -                                
     TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||    
     LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||             
     LEAST(NVL(PCPEDC.minuto, '00'), 59) || ':00',           
     'dd/mm/yyyy hh24:mi:ss')) * 24)                           
   ELSE                                                          
     NULL                                                        
   END) AS NUMBER(18, 4)) TEMPO_HORA,                            
 CASE WHEN PCPEDC.DTFAT IS NOT NULL THEN                            
   TO_CHAR(EXTRACT(HOUR FROM NUMTODSINTERVAL(                       
     ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' ||    
     LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||             
     LEAST(NVL(PCPEDC.minutofat, '00'), 59) ||                    
     ':00',                                                       
     'dd/mm/yyyy hh24:mi:ss') -                                   
     TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||       
     LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||                
     LEAST(NVL(PCPEDC.minuto, '00'), 59) ||                       
     ':00',                                                       
     'dd/mm/yyyy hh24:mi:ss')))                                   
     , 'DAY')), 'FM00')                                          
     || ':' ||                                                    
   TO_CHAR(EXTRACT(MINUTE FROM NUMTODSINTERVAL(                     
     ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' ||    
     LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||             
     LEAST(NVL(PCPEDC.minutofat, '00'), 59) ||                    
     ':00',                                                       
     'dd/mm/yyyy hh24:mi:ss') -                                   
     TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||       
     LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||                
     LEAST(NVL(PCPEDC.minuto, '00'), 59) ||                       
     ':00',                                                       
     'dd/mm/yyyy hh24:mi:ss')))                                   
     , 'DAY')), 'FM00')                                          
     || ':' ||                                                    
     '00'                                                        
  ELSE NULL END                                                      
  AS  clTempoTotal ,                                                
 PCPEDC.NUMPEDCLI, 
 nvl(PCPEDC.NUMITENS,0) NUMITENS, 
CASE
WHEN EXISTS
(SELECT PCPEDIDO.NUMTRANSVENDA
FROM PCPEDIDO
WHERE PCPEDIDO.NUMTRANSVENDA = PCPEDC.NUMTRANSVENDA) THEN
'S'
ELSE
'N'
END RECEBIDO,
NVL(                                                            
     (SELECT PCCLIENTENDENT.ENDERENT                            
      FROM PCCLIENTENDENT                                       
      WHERE PCCLIENT.CODCLI = PCCLIENTENDENT.CODCLI             
        AND PCPEDC.CODENDENTCLI = PCCLIENTENDENT.CODENDENTCLI), 
      PCCLIENT.ENDERCOM                                          
     ) ENDERCOM,                                                
PCCLIENT.FANTASIA, PCPEDC.CODUSUR2,
(SELECT PCUSUARI.NOME FROM PCUSUARI WHERE PCUSUARI.CODUSUR = PCPEDC.CODUSUR2 AND ROWNUM=1) RCA2,
PCCLIENT.CODCIDADE,
(SELECT PCCIDADE.NOMECIDADE FROM PCCIDADE WHERE PCCLIENT.CODCIDADE = PCCIDADE.CODCIDADE  AND ROWNUM=1) NOMECIDADE
,PCPEDC.CODPRACA
,       (SELECT PCPRACA.PRACA                           
           FROM PCPRACA                                  
          WHERE PCPEDC.CODPRACA = PCPRACA.CODPRACA       
            AND ROWNUM = 1) PRACA                        
,PCCLIENT.ENDERENT 
,PCCLIENT.CGCENT 
,PCCLIENT.PONTOREFER
,PCPEDC.CODFORNECFRETE
,PCPEDC.NUMSEQENTREGA
,PCPEDC.CODFORNECREDESPACHO
,(SELECT PCCARREG.CODFUNCAJUD
    FROM PCCARREG
WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR  AND ROWNUM=1) CODFUNCAJUD
,(SELECT PCFORNEC.FORNECEDOR FROM PCFORNEC WHERE PCFORNEC.CODFORNEC = PCPEDC.CODFORNECFRETE  AND ROWNUM=1)FORNECCFRETE
,(SELECT PCFORNEC.FORNECEDOR FROM PCFORNEC WHERE PCFORNEC.CODFORNEC = PCPEDC.CODFORNECREDESPACHO  AND ROWNUM=1)FORNECDESPACHO,
       DECODE(NVL(PCPEDC.FRETEDESPACHO,'N'),'C','CIF', 'F', 'FOB', 'T', 'TERCEIRO', 'R', 'PROPRIO CIF', 'D', 'PROPRIO FOB', 'G', 'GRATUITO', 'SEM FRETE')FRETEDESPACHO,
       PCPEDC.DTEXPORTACAO,
       PCPEDC.DTIMPORTACAO,
       PCPEDC.NUMVIASMAPASEP,
       PCPEDC.NUMPEDRCA,
       PCPEDC.CODFILIAL,
       PCPEDC.CODFILIALNF,
       PCPEDC.CONDVENDA,
       PCPEDC.DATA,
       PCPEDC.DTCANCEL,
       PCPEDC.POSICAO,
       PCPEDC.CODCLI,
       PCCLIENT.CLIENTE,
       PCCLIENT.UFRG,
       PCCLIENT.ESTENT, 
       PCPEDC.VLTOTAL VLTOTAL,
       DECODE(PCPEDC.CONDVENDA,4,SUM(0), 
       5,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       6,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       8,SUM(0), 
       11,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       12,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       13,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       20,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
       PCPEDC.VLATEND) VLATEND, 
       PCPEDC.CODUSUR, 
       PCPEDC.NUMCAR, 
       PCUSUARI.NOME, 
       PCPEDC.CODEMITENTE,
       PCPEDC.CODFUNCLIBERA,
       PCPEDC.CODFUNCCONF,
       PCPEDC.CODPLPAG,
       PCPLPAG.DESCRICAO,
       PCPEDC.PRAZO1, 
       PCPEDC.PRAZO2, 
       PCPEDC.PRAZO3, 
       PCPEDC.PRAZO4, 
       PCPEDC.PRAZO5, 
       PCPEDC.PRAZO6, 
       PCPEDC.PRAZO7, 
       PCPEDC.PRAZO8, 
       PCPEDC.PRAZO9, 
       PCPEDC.PRAZO10, 
       PCPEDC.PRAZO11, 
       PCPEDC.PRAZO12, 
       PCPEDC.PRAZOMEDIO, 
       PCPEDC.OBS, 
       PCPEDC.OBS1, 
       PCPEDC.OBS2,
       PCPEDC.OBSENTREGA1, 
       PCPEDC.OBSENTREGA2, 
       PCPEDC.OBSENTREGA3, 
       PCPEDC.HORA, 
       PCPEDC.MINUTO, 
        PCPEDC.CODCOB, 
        PCPEDC.NUMCAIXA,
        PCPEDC.NUMTRANSVENDA,
       PCPEDC.DTFAT, PCPEDC.HORAFAT, PCPEDC.MINUTOFAT,
 (SELECT PCCARREG.HORAMON
          FROM PCCARREG
          WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1) HORAMON,
        (SELECT PCCARREG.MINUTOMON
           FROM PCCARREG
          WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1) MINUTOMON,
       PCPEDC.DTLIBERA,
       PCPEDC.MOTIVOPOSICAO, 
  CASE WHEN NVL(PCPEDC.VLATEND, 0) = 0 THEN -100 WHEN NVL(PCPEDC.CONDVENDA, 0) = 5 THEN -100 ELSE
 ((NVL(PCPEDC.VLATEND, 0)- NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) - NVL(PCPEDC.VLCUSTOFIN, 0))
 / DECODE ( (DECODE(NVL(PCPEDC.VLATEND, 0), 0, 1, NVL(PCPEDC.VLATEND, 0) - NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) ))
  ,0,1,  (DECODE(NVL(PCPEDC.VLATEND, 0), 0, 1, NVL(PCPEDC.VLATEND, 0) - NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) ))
 ) * 100) END AS PERCLUCRO,
       DECODE(DECODE(LENGTH(TO_CHAR(PCPEDC.HORALIBERA)),1,'0'||TO_CHAR(PCPEDC.HORALIBERA),
                                                   TO_CHAR(PCPEDC.HORALIBERA)) ||':'|| DECODE(LENGTH(TO_CHAR(PCPEDC.MINUTOLIBERA)),1,'0'||TO_CHAR(PCPEDC.MINUTOLIBERA),
                                                                                  TO_CHAR(PCPEDC.MINUTOLIBERA)),':','',DECODE(LENGTH(TO_CHAR(PCPEDC.HORALIBERA)),1,'0'||TO_CHAR(PCPEDC.HORALIBERA),
                                                                                  TO_CHAR(PCPEDC.HORALIBERA)) ||':'|| DECODE(LENGTH(TO_CHAR(PCPEDC.MINUTOLIBERA)),1,'0'||TO_CHAR(PCPEDC.MINUTOLIBERA),
                                                                                  TO_CHAR(PCPEDC.MINUTOLIBERA))) HORALIB,
       PCPEDC.NUMPEDTV3,
       PCPEDC.CODCLINF,
       PCPEDC.ORIGEMPED,
       PCPEDC.DTABERTURAPEDPALM, PCPEDC.DTFECHAMENTOPEDPALM, 
       PCPEDC.VLENTRADA,
       PCPEDC.NUMPEDENTFUT, 
       PCPEDC.NUMPEDWEB,
       PCPEDC.NUMPEDMKTPLACE,
       PCPEDC.VLDESCONTOCUPOM,
       NVL(PCPEDC.PAGAMENTOAPROVADOCIASHOP, 'N') PAGAMENTOAPROVADOCIASHOP,
       NVL(PCPEDC.VLBONIFIC, 0) VLBONIFIC,
 (SELECT PCEMPR.NOME
           FROM PCEMPR
          WHERE PCPEDC.CODEMITENTE = PCEMPR.MATRICULA AND ROWNUM=1) NOMEEMITENTE,
 (CASE                                                                  
   WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                           
        ''                                                             
   ELSE                                                                 
        (SELECT PCEMPR.NOME                                             
           FROM PCEMPR, PCCARREG                                        
          WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR                         
            AND PCCARREG.CODMOTORISTA = PCEMPR.MATRICULA AND ROWNUM=1)  
   END) CMOTORISTA,                                                     
       (SELECT PCEMPR.NOME
          FROM PCEMPR
         WHERE PCPEDC.CODFUNCLIBERA = PCEMPR.MATRICULA AND ROWNUM=1) CLNOMEFUNCLIBERA,
       (SELECT PCEMPR.NOME
          FROM PCEMPR
         WHERE PCPEDC.CODFUNCCONF = PCEMPR.MATRICULA AND ROWNUM=1) CLNOMEFUNCCONF,
       (SELECT PCEMPR.NOME
          FROM PCEMPR, PCCARREG
         WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR
           AND PCCARREG.CODFUNCAJUD = PCEMPR.MATRICULA AND ROWNUM=1) NOMEFUNCAJUDANTE,
 (CASE                                                        
   WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                 
        NULL                                                  
   ELSE                                                       
       (SELECT PCCARREG.CODMOTORISTA                          
          FROM PCCARREG                                       
         WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1)  
   END ) CCODMOTORISTA,                                       
 (CASE                                                        
   WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                 
        NULL                                                  
   ELSE                                                       
       (SELECT PCCARREG.DTSAIDA                          
          FROM PCCARREG                                       
         WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1)  
   END ) DTSAIDACARREG,                                       
 (CASE                                                                   
   WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                            
        ''                                                             
   ELSE                                                                 
       (SELECT PCVEICUL.PLACA                                            
          FROM PCVEICUL, PCCARREG                                        
         WHERE PCPEDC.NUMCAR = PCCARREG.NUMCAR                            
           AND PCVEICUL.CODVEICULO = PCCARREG.CODVEICULO AND ROWNUM=1)   
   END ) cPLACA,                                                          
       NVL(MAX((SELECT MAX(nvl(PCNFSAID.NUMNOTA,PCNFSAID.NUMCUPOM)) FROM PCNFSAID WHERE
               NUMPED    = PCPEDC.NUMPED
           AND CODCLI    = PCPEDC.CODCLI
           AND CODFILIAL = PCPEDC.CODFILIAL AND PCNFSAID.NUMTRANSENTNFESTORNADA IS NULL)),NVL(PCPEDC.NUMNOTA,PCPEDC.NUMCUPOM)) CNUMNOTA,
       PCPEDC.TOTPESO,
       NVL(pcpedc.utilizavendaporembalagem, 'N') UtilizaVendaPorEmbalagem,
       ' ' HORACANC,
       PCPEDC.VLFRETE,
       (SELECT COUNT (1)
          FROM pcpedi
         WHERE pcpedi.numped = pcpedc.numped
           AND pcpedi.bonific IS NOT NULL
           AND pcpedi.bonific = 'S') tot_bonific,
  (decode((select 'S'                                                       
                from PCNFSAIDprefat  prefat                                   
               where numped = pcpedc.numped                                   
                 and not Exists                                               
               (select numped                                                
                        from pcnfsaid                                         
                       where prefat.numtransvenda = pcnfsaid.numtransvenda)), 
              'S',                                                         
              'S',                                                         
              'N'))AguardandoSefaz,                                          
   NVL(PCPEDC.TOTVOLUME,0 ) TOTVOLUME,                                         
(select max(vendas.tipo_transferencia(c.codfilial,                              
  nvl(i.codfilialretira, c.codfilial),                                          
  nvl(c.codfilialnf, c.codfilial))) from pcpedc c, pcpedi i                      
 where c.numped = i.numped and c.numped = pcpedc.numped)  tipo_transferencia    
  ,PCPEDC.CODIGORASTREIOFRETEVENDA
FROM PCPEDI, PCCLIENT, PCUSUARI, PCPEDC, PCPLPAG
WHERE PCPEDC.CODCLI        = PCCLIENT.CODCLI
AND   PCPEDC.CODUSUR       = PCUSUARI.CODUSUR
AND   PCPEDC.NUMPED        = PCPEDI.NUMPED
AND   PCPEDC.CODPLPAG      = PCPLPAG.CODPLPAG(+)
AND TRUNC(PCPEDC.DATA) >= TRUNC(:DTINI)
AND TRUNC(PCPEDC.DATA) <  TRUNC(:DTFIM)
AND TRUNC(PCPEDI.DATA) >= TRUNC(:DTINI)
AND TRUNC(PCPEDI.DATA) <  TRUNC(:DTFIM)

AND PCPEDC.POSICAO IN ('','M','L','B','P','F','')
  AND PCPEDC.ORIGEMPED = 'A'
  AND ( :CODFUNC IS NULL OR PCUSUARI.CODSUPERVISOR IN 
              ( SELECT CODIGON 
                FROM PCLIB 
                WHERE CODFUNC = :CODFUNC 
                AND CODTABELA = 7) ) 
  AND ( :CODFUNC IS NULL OR PCPEDC.CODFILIAL IN 
              ( SELECT CODIGOA 
                FROM PCLIB 
                WHERE CODFUNC = :CODFUNC 
                AND CODTABELA = 1) ) 
GROUP BY PCPEDC.NUMPED, PCPEDC.RECARGA, PCPEDC.DTENTREGA,
 PCPEDC.NUMPEDCLI, nvl(PCPEDC.NUMITENS,0), 
       PCCLIENT.FANTASIA,PCCLIENT.ENDERCOM, PCPEDC.CODUSUR2, PCCLIENT.ENDERENT, PCCLIENT.CGCENT,
PCCLIENT.CODCLI, PCPEDC.CODENDENTCLI,
       PCPEDC.DTEXPORTACAO,
       PCPEDC.DTIMPORTACAO,
       PCPEDC.NUMVIASMAPASEP,
       PCPEDC.NUMPEDRCA,
       PCPEDC.CODFILIAL, 
       PCPEDC.CODFILIALNF,
       PCPEDC.CONDVENDA, 
       PCPEDC.DATA, 
       PCPEDC.VLOUTRASDESP, 
       PCPEDC.VLFRETE, 
       PCPEDC.DTCANCEL, 
       PCPEDC.POSICAO, 
       PCPEDC.CODCLI,
       PCCLIENT.CLIENTE, 
       PCPEDC.VLTOTAL, 
       PCPEDC.VLATEND, 
       PCPEDC.CODUSUR, 
       PCPEDC.NUMCAR, 
       PCUSUARI.NOME, 
       PCPEDC.CODEMITENTE,
       PCPEDC.CODFUNCLIBERA,
       PCPEDC.CODFUNCCONF,
       PCPEDC.CODPLPAG,
       PCPLPAG.DESCRICAO,
       PCPEDC.PRAZO1, 
       PCPEDC.PRAZO2, 
       PCPEDC.PRAZO3, 
       PCPEDC.PRAZO4, 
       PCPEDC.PRAZO5, 
       PCPEDC.PRAZO6, 
       PCPEDC.PRAZO7, 
       PCPEDC.PRAZO8, 
       PCPEDC.PRAZO9, 
       PCPEDC.PRAZO10, 
       PCPEDC.PRAZO11, 
       PCPEDC.PRAZO12, 
       PCPEDC.PRAZOMEDIO, 
       PCPEDC.OBS, 
       PCPEDC.OBS1, 
       PCPEDC.OBS2,
       PCPEDC.OBSENTREGA1, 
       PCPEDC.OBSENTREGA2, 
       PCPEDC.OBSENTREGA3, 
       PCPEDC.HORA, 
       PCPEDC.MINUTO, 
          PCPEDC.CODCOB, 
          PCPEDC.NUMCAIXA,
          PCPEDC.MOTIVOPOSICAO, 
       PCPEDC.NUMNOTA, 
       PCPEDC.NUMTRANSVENDA,
       PCPEDC.DTFAT, PCPEDC.HORAFAT, PCPEDC.MINUTOFAT,
       PCPEDC.DTLIBERA, PCPEDC.HORALIBERA, PCPEDC.MINUTOLIBERA,PCPEDC.NUMPEDTV3,PCPEDC.CODCLINF,PCPEDC.ORIGEMPED, 
       PCPEDC.DTABERTURAPEDPALM, PCPEDC.DTFECHAMENTOPEDPALM, 
       PCPEDC.TOTPESO,
       PCPEDC.FRETEDESPACHO,
       PCPEDC.CODFORNECFRETE, PCPEDC.NUMSEQENTREGA, PCPEDC.CODFORNECREDESPACHO,
       PCCLIENT.UFRG,
       PCCLIENT.ESTENT,
       PCCLIENT.CODCIDADE,
       PCPEDC.CODPRACA,
       PCPEDC.NUMSEQENTREGA,
       PCCLIENT.PONTOREFER,
       PCCLIENT.OBSENTREGA2,
       PCCLIENT.OBSENTREGA3,
       PCPEDC.VLCUSTOFIN,
       NVL(PCPEDC.VLBONIFIC, 0),
       PCPEDC.VLFRETE,
       PCPEDC.VLENTRADA,
       PCPEDC.NUMPEDENTFUT,
       PCPEDC.NUMPEDWEB,
       PCPEDC.NUMPEDMKTPLACE,
       PCPEDC.VLDESCONTOCUPOM,
       NVL(PCPEDC.PAGAMENTOAPROVADOCIASHOP, 'N')
       ,PCPEDC.NUMCUPOM
       ,PCPEDC.TOTVOLUME
       ,NVL(pcpedc.utilizavendaporembalagem, 'N')
       ,PCPEDC.CODIGORASTREIOFRETEVENDA
ORDER BY PCPEDC.NUMPED
`;

// Consulta incremental de pedidos recentes, ordenando por DTENTREGA, HORA e MINUTO
// Usa um marcador de última referência (DTENTREGA/HORA/MINUTO) para buscar apenas novos registros
const PEDIDOS_RECENTES_SQL = `
SELECT * FROM (
  SELECT PCPEDC.NUMPED, NVL(PCPEDC.RECARGA,'N') RECARGA, PCPEDC.DTENTREGA,
   CAST((                                                            
     CASE WHEN LENGTH(PCPEDC.DTFAT) > 0 THEN                        
       ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' || 
       LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||           
       LEAST(NVL(PCPEDC.minutofat, '00'), 59) || ':00',         
       'dd/mm/yyyy hh24:mi:ss') -                                 
       TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||     
       LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||              
       LEAST(NVL(PCPEDC.minuto, '00'), 59) || ':00',            
       'dd/mm/yyyy hh24:mi:ss')) * 24)                            
     ELSE                                                          
       NULL                                                       
     END) AS NUMBER(18, 4)) TEMPO_HORA,                           
   CASE WHEN PCPEDC.DTFAT IS NOT NULL THEN                            
     TO_CHAR(EXTRACT(HOUR FROM NUMTODSINTERVAL(                        
       ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' ||     
       LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||              
       LEAST(NVL(PCPEDC.minutofat, '00'), 59) ||                     
       ':00',                                                       
       'dd/mm/yyyy hh24:mi:ss') -                                   
       TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||        
       LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||                 
       LEAST(NVL(PCPEDC.minuto, '00'), 59) ||                        
       ':00',                                                       
       'dd/mm/yyyy hh24:mi:ss')))                                   
       , 'DAY')), 'FM00')                                          
       || ':' ||                                                    
     TO_CHAR(EXTRACT(MINUTE FROM NUMTODSINTERVAL(                      
       ((TO_DATE(TO_CHAR(PCPEDC.dtfat, 'dd/mm/yyyy') || ' ' ||     
       LEAST(NVL(PCPEDC.horafat, '00'), 23) || ':' ||              
       LEAST(NVL(PCPEDC.minutofat, '00'), 59) ||                     
       ':00',                                                       
       'dd/mm/yyyy hh24:mi:ss') -                                   
       TO_DATE(TO_CHAR(PCPEDC.DATA, 'dd/mm/yyyy') || ' ' ||        
       LEAST(NVL(PCPEDC.hora, '00'), 23) || ':' ||                 
       LEAST(NVL(PCPEDC.minuto, '00'), 59) ||                        
       ':00',                                                       
       'dd/mm/yyyy hh24:mi:ss')))                                   
       , 'DAY')), 'FM00')                                          
       || ':' ||                                                    
       '00'                                                        
    ELSE NULL END                                                      
    AS  clTempoTotal ,                                                
   PCPEDC.NUMPEDCLI, 
   nvl(PCPEDC.NUMITENS,0) NUMITENS, 
  CASE
  WHEN EXISTS
  (SELECT PCPEDIDO.NUMTRANSVENDA
  FROM PCPEDIDO
  WHERE PCPEDIDO.NUMTRANSVENDA = PCPEDC.NUMTRANSVENDA) THEN
  'S'
  ELSE
  'N'
  END RECEBIDO,
  NVL(                                                            
       (SELECT PCCLIENTENDENT.ENDERENT                             
        FROM PCCLIENTENDENT                                        
        WHERE PCCLIENT.CODCLI = PCCLIENTENDENT.CODCLI              
          AND PCPEDC.CODENDENTCLI = PCCLIENTENDENT.CODENDENTCLI),  
        PCCLIENT.ENDERCOM                                          
       ) ENDERCOM,                                                 
  PCCLIENT.FANTASIA, PCPEDC.CODUSUR2,
  (SELECT PCUSUARI.NOME FROM PCUSUARI WHERE PCUSUARI.CODUSUR = PCPEDC.CODUSUR2 AND ROWNUM=1) RCA2,
  PCCLIENT.CODCIDADE,
  (SELECT PCCIDADE.NOMECIDADE FROM PCCIDADE WHERE PCCLIENT.CODCIDADE = PCCIDADE.CODCIDADE  AND ROWNUM=1) NOMECIDADE
  ,PCPEDC.CODPRACA
  ,       (SELECT PCPRACA.PRACA                            
             FROM PCPRACA                                   
            WHERE PCPEDC.CODPRACA = PCPRACA.CODPRACA        
              AND ROWNUM = 1) PRACA                         
  ,PCCLIENT.ENDERENT 
  ,PCCLIENT.CGCENT 
  ,PCCLIENT.PONTOREFER
  ,PCPEDC.CODFORNECFRETE
  ,PCPEDC.NUMSEQENTREGA
  ,PCPEDC.CODFORNECREDESPACHO
  ,(SELECT PCCARREG.CODFUNCAJUD
      FROM PCCARREG
    WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR  AND ROWNUM=1) CODFUNCAJUD
  ,(SELECT PCFORNEC.FORNECEDOR FROM PCFORNEC WHERE PCFORNEC.CODFORNEC = PCPEDC.CODFORNECFRETE  AND ROWNUM=1)FORNECCFRETE
  ,(SELECT PCFORNEC.FORNECEDOR FROM PCFORNEC WHERE PCFORNEC.CODFORNEC = PCPEDC.CODFORNECREDESPACHO  AND ROWNUM=1)FORNECDESPACHO,
         DECODE(NVL(PCPEDC.FRETEDESPACHO,'N'),'C','CIF', 'F', 'FOB', 'T', 'TERCEIRO', 'R', 'PROPRIO CIF', 'D', 'PROPRIO FOB', 'G', 'GRATUITO', 'SEM FRETE')FRETEDESPACHO,
         PCPEDC.DTEXPORTACAO,
         PCPEDC.DTIMPORTACAO,
         PCPEDC.NUMVIASMAPASEP,
         PCPEDC.NUMPEDRCA,
         PCPEDC.CODFILIAL,
         PCPEDC.CODFILIALNF,
         PCPEDC.CONDVENDA,
         PCPEDC.DATA,
         PCPEDC.DTCANCEL,
         PCPEDC.POSICAO,
         PCPEDC.CODCLI,
         PCCLIENT.CLIENTE,
         PCCLIENT.UFRG,
         PCCLIENT.ESTENT, 
         PCPEDC.VLTOTAL VLTOTAL,
         DECODE(PCPEDC.CONDVENDA,4,SUM(0), 
         5,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         6,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         8,SUM(0), 
         11,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         12,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         13,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         20,SUM(NVL(PCPEDI.QT,0) * NVL(PCPEDI.PVENDA,0)), 
         PCPEDC.VLATEND) VLATEND, 
         PCPEDC.CODUSUR, 
         PCPEDC.NUMCAR, 
         PCUSUARI.NOME, 
         PCPEDC.CODEMITENTE,
         PCPEDC.CODFUNCLIBERA,
         PCPEDC.CODFUNCCONF,
         PCPEDC.CODPLPAG,
         PCPLPAG.DESCRICAO,
         PCPEDC.PRAZO1, 
         PCPEDC.PRAZO2, 
         PCPEDC.PRAZO3, 
         PCPEDC.PRAZO4, 
         PCPEDC.PRAZO5, 
         PCPEDC.PRAZO6, 
         PCPEDC.PRAZO7, 
         PCPEDC.PRAZO8, 
         PCPEDC.PRAZO9, 
         PCPEDC.PRAZO10, 
         PCPEDC.PRAZO11, 
         PCPEDC.PRAZO12, 
         PCPEDC.PRAZOMEDIO, 
         PCPEDC.OBS, 
         PCPEDC.OBS1, 
         PCPEDC.OBS2,
         PCPEDC.OBSENTREGA1, 
         PCPEDC.OBSENTREGA2, 
         PCPEDC.OBSENTREGA3, 
         PCPEDC.HORA, 
         PCPEDC.MINUTO, 
         PCPEDC.CODCOB, 
         PCPEDC.NUMTRANSVENDA,
         PCPEDC.DTFAT, PCPEDC.HORAFAT, PCPEDC.MINUTOFAT,
   (SELECT PCCARREG.HORAMON
            FROM PCCARREG
            WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1) HORAMON,
          (SELECT PCCARREG.MINUTOMON
             FROM PCCARREG
            WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1) MINUTOMON,
         PCPEDC.DTLIBERA,
         PCPEDC.MOTIVOPOSICAO, 
    CASE WHEN NVL(PCPEDC.VLATEND, 0) = 0 THEN -100 WHEN NVL(PCPEDC.CONDVENDA, 0) = 5 THEN -100 ELSE
   ((NVL(PCPEDC.VLATEND, 0)- NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) - NVL(PCPEDC.VLCUSTOFIN, 0))
   / DECODE ( (DECODE(NVL(PCPEDC.VLATEND, 0), 0, 1, NVL(PCPEDC.VLATEND, 0) - NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) ))
    ,0,1,  (DECODE(NVL(PCPEDC.VLATEND, 0), 0, 1, NVL(PCPEDC.VLATEND, 0) - NVL(PCPEDC.VLOUTRASDESP, 0)  - NVL(PCPEDC.VLFRETE, 0) ))
   ) * 100) END AS PERCLUCRO,
         DECODE(DECODE(LENGTH(TO_CHAR(PCPEDC.HORALIBERA)),1,'0'||TO_CHAR(PCPEDC.HORALIBERA),
                                                     TO_CHAR(PCPEDC.HORALIBERA)) ||':'|| DECODE(LENGTH(TO_CHAR(PCPEDC.MINUTOLIBERA)),1,'0'||TO_CHAR(PCPEDC.MINUTOLIBERA),
                                                                                    TO_CHAR(PCPEDC.MINUTOLIBERA)),':','',DECODE(LENGTH(TO_CHAR(PCPEDC.HORALIBERA)),1,'0'||TO_CHAR(PCPEDC.HORALIBERA),
                                                                                    TO_CHAR(PCPEDC.HORALIBERA)) ||':'|| DECODE(LENGTH(TO_CHAR(PCPEDC.MINUTOLIBERA)),1,'0'||TO_CHAR(PCPEDC.MINUTOLIBERA),
                                                                                    TO_CHAR(PCPEDC.MINUTOLIBERA))) HORALIB,
         PCPEDC.NUMPEDTV3,
         PCPEDC.CODCLINF,
         PCPEDC.ORIGEMPED,
         PCPEDC.DTABERTURAPEDPALM, PCPEDC.DTFECHAMENTOPEDPALM, 
         PCPEDC.VLENTRADA,
         PCPEDC.NUMPEDENTFUT, 
         PCPEDC.NUMPEDWEB,
         PCPEDC.NUMPEDMKTPLACE,
         PCPEDC.VLDESCONTOCUPOM,
         NVL(PCPEDC.PAGAMENTOAPROVADOCIASHOP, 'N') PAGAMENTOAPROVADOCIASHOP,
         NVL(PCPEDC.VLBONIFIC, 0) VLBONIFIC,
   (SELECT PCEMPR.NOME
             FROM PCEMPR
            WHERE PCPEDC.CODEMITENTE = PCEMPR.MATRICULA AND ROWNUM=1) NOMEEMITENTE,
   (CASE                                                                  
     WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                            
          ''                                                             
     ELSE                                                                
          (SELECT PCEMPR.NOME                                             
             FROM PCEMPR, PCCARREG                                        
            WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR                          
              AND PCCARREG.CODMOTORISTA = PCEMPR.MATRICULA AND ROWNUM=1)  
     END) CMOTORISTA,                                                     
         (SELECT PCEMPR.NOME
            FROM PCEMPR
           WHERE PCPEDC.CODFUNCLIBERA = PCEMPR.MATRICULA AND ROWNUM=1) CLNOMEFUNCLIBERA,
         (SELECT PCEMPR.NOME
            FROM PCEMPR
           WHERE PCPEDC.CODFUNCCONF = PCEMPR.MATRICULA AND ROWNUM=1) CLNOMEFUNCCONF,
         (SELECT PCEMPR.NOME
            FROM PCEMPR, PCCARREG
           WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR
             AND PCCARREG.CODFUNCAJUD = PCEMPR.MATRICULA AND ROWNUM=1) NOMEFUNCAJUDANTE,
   (CASE                                                         
     WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                  
          NULL                                                   
     ELSE                                                       
         (SELECT PCCARREG.CODMOTORISTA                          
            FROM PCCARREG                                       
           WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1)  
     END ) CCODMOTORISTA,                                       
   (CASE                                                         
     WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                  
          NULL                                                   
     ELSE                                                       
         (SELECT PCCARREG.DTSAIDA                          
            FROM PCCARREG                                       
           WHERE PCCARREG.NUMCAR = PCPEDC.NUMCAR AND ROWNUM=1)  
     END ) DTSAIDACARREG,                                       
   (CASE                                                                    
     WHEN PCPEDC.POSICAO IN ('L', 'B') THEN                             
          ''                                                              
     ELSE                                                                 
         (SELECT PCVEICUL.PLACA                                             
            FROM PCVEICUL, PCCARREG                                         
           WHERE PCPEDC.NUMCAR = PCCARREG.NUMCAR                             
             AND PCVEICUL.CODVEICULO = PCCARREG.CODVEICULO AND ROWNUM=1)    
     END ) cPLACA,                                                          
         NVL(MAX((SELECT MAX(nvl(PCNFSAID.NUMNOTA,PCNFSAID.NUMCUPOM)) FROM PCNFSAID WHERE
                 NUMPED    = PCPEDC.NUMPED
             AND CODCLI    = PCPEDC.CODCLI
             AND CODFILIAL = PCPEDC.CODFILIAL AND PCNFSAID.NUMTRANSENTNFESTORNADA IS NULL)),NVL(PCPEDC.NUMNOTA,PCPEDC.NUMCUPOM)) CNUMNOTA,
         PCPEDC.TOTPESO,
         NVL(pcpedc.utilizavendaporembalagem, 'N') UtilizaVendaPorEmbalagem,
         ' ' HORACANC,
         PCPEDC.VLFRETE,
         (SELECT COUNT (1)
            FROM pcpedi
           WHERE pcpedi.numped = pcpedc.numped
             AND pcpedi.bonific IS NOT NULL
             AND pcpedi.bonific = 'S') tot_bonific,
    (decode((select 'S'                                                       
                  from PCNFSAIDprefat  prefat                                   
                 where numped = pcpedc.numped                                   
                   and not Exists                                               
                 (select numped                                                
                          from pcnfsaid                                        
                         where prefat.numtransvenda = pcnfsaid.numtransvenda)), 
                'S',                                                          
                'S',                                                          
                'N'))AguardandoSefaz,                                          
     NVL(PCPEDC.TOTVOLUME,0 ) TOTVOLUME,                                          
  (select max(vendas.tipo_transferencia(c.codfilial,                               
    nvl(i.codfilialretira, c.codfilial),                                           
    nvl(c.codfilialnf, c.codfilial))) from pcpedc c, pcpedi i                      
   where c.numped = i.numped and c.numped = pcpedc.numped)  tipo_transferencia     
    ,PCPEDC.CODIGORASTREIOFRETEVENDA
  FROM PCPEDI, PCCLIENT, PCUSUARI, PCPEDC, PCPLPAG
  WHERE PCPEDC.CODCLI        = PCCLIENT.CODCLI
  AND   PCPEDC.CODUSUR       = PCUSUARI.CODUSUR
  AND   PCPEDC.NUMPED        = PCPEDI.NUMPED
  AND   PCPEDC.CODPLPAG      = PCPLPAG.CODPLPAG(+)
  AND   NVL(PCPEDC.DTENTREGA, PCPEDC.DATA) IS NOT NULL
  AND (
         TRUNC(NVL(PCPEDC.DTENTREGA, PCPEDC.DATA)) > TRUNC(:DTENTREGA_REF)
       OR (
            TRUNC(NVL(PCPEDC.DTENTREGA, PCPEDC.DATA)) = TRUNC(:DTENTREGA_REF)
        AND ( NVL(PCPEDC.HORA,0) > :HORA_REF
           OR ( NVL(PCPEDC.HORA,0) = :HORA_REF AND NVL(PCPEDC.MINUTO,0) > :MINUTO_REF )
            )
         )
      )
  AND PCPEDC.POSICAO IN ('','M','L','B','P','F','')
  AND PCPEDC.ORIGEMPED = 'A'
  AND ( :CODFUNC IS NULL OR PCUSUARI.CODSUPERVISOR IN 
                ( SELECT CODIGON 
                  FROM PCLIB 
                  WHERE CODFUNC = :CODFUNC 
                  AND CODTABELA = 7) ) 
  AND ( :CODFUNC IS NULL OR PCPEDC.CODFILIAL IN 
                ( SELECT CODIGOA 
                  FROM PCLIB 
                  WHERE CODFUNC = :CODFUNC 
                  AND CODTABELA = 1) ) 
  GROUP BY PCPEDC.NUMPED, PCPEDC.RECARGA, PCPEDC.DTENTREGA,
   PCPEDC.NUMPEDCLI, nvl(PCPEDC.NUMITENS,0), 
         PCCLIENT.FANTASIA,PCCLIENT.ENDERCOM, PCPEDC.CODUSUR2, PCCLIENT.ENDERENT, PCCLIENT.CGCENT,
  PCCLIENT.CODCLI, PCPEDC.CODENDENTCLI,
         PCPEDC.DTEXPORTACAO,
         PCPEDC.DTIMPORTACAO,
         PCPEDC.NUMVIASMAPASEP,
         PCPEDC.NUMPEDRCA,
         PCPEDC.CODFILIAL, 
         PCPEDC.CODFILIALNF,
         PCPEDC.CONDVENDA, 
         PCPEDC.DATA, 
         PCPEDC.VLOUTRASDESP, 
         PCPEDC.VLFRETE, 
         PCPEDC.DTCANCEL, 
         PCPEDC.POSICAO, 
         PCPEDC.CODCLI,
         PCCLIENT.CLIENTE, 
         PCPEDC.VLTOTAL, 
         PCPEDC.VLATEND, 
         PCPEDC.CODUSUR, 
         PCPEDC.NUMCAR, 
         PCUSUARI.NOME, 
         PCPEDC.CODEMITENTE,
         PCPEDC.CODFUNCLIBERA,
         PCPEDC.CODFUNCCONF,
         PCPEDC.CODPLPAG,
         PCPLPAG.DESCRICAO,
         PCPEDC.PRAZO1, 
         PCPEDC.PRAZO2, 
         PCPEDC.PRAZO3, 
         PCPEDC.PRAZO4, 
         PCPEDC.PRAZO5, 
         PCPEDC.PRAZO6, 
         PCPEDC.PRAZO7, 
         PCPEDC.PRAZO8, 
         PCPEDC.PRAZO9, 
         PCPEDC.PRAZO10, 
         PCPEDC.PRAZO11, 
         PCPEDC.PRAZO12, 
         PCPEDC.PRAZOMEDIO, 
         PCPEDC.OBS, 
         PCPEDC.OBS1, 
         PCPEDC.OBS2,
         PCPEDC.OBSENTREGA1, 
         PCPEDC.OBSENTREGA2, 
         PCPEDC.OBSENTREGA3, 
          PCPEDC.HORA, 
          PCPEDC.MINUTO, 
          PCPEDC.CODCOB, 
          PCPEDC.NUMCAIXA,
          PCPEDC.MOTIVOPOSICAO, 
          PCPEDC.NUMNOTA, 
          PCPEDC.NUMTRANSVENDA,
         PCPEDC.DTFAT, PCPEDC.HORAFAT, PCPEDC.MINUTOFAT,
         PCPEDC.DTLIBERA, PCPEDC.HORALIBERA, PCPEDC.MINUTOLIBERA,PCPEDC.NUMPEDTV3,PCPEDC.CODCLINF,PCPEDC.ORIGEMPED, 
         PCPEDC.DTABERTURAPEDPALM, PCPEDC.DTFECHAMENTOPEDPALM, 
         PCPEDC.TOTPESO,
         PCPEDC.FRETEDESPACHO,
         PCPEDC.CODFORNECFRETE, PCPEDC.NUMSEQENTREGA, PCPEDC.CODFORNECREDESPACHO,
         PCCLIENT.UFRG,
         PCCLIENT.ESTENT,
         PCCLIENT.CODCIDADE,
         PCPEDC.CODPRACA,
         PCPEDC.NUMSEQENTREGA,
         PCCLIENT.PONTOREFER,
         PCCLIENT.OBSENTREGA2,
         PCCLIENT.OBSENTREGA3,
         PCPEDC.VLCUSTOFIN,
         NVL(PCPEDC.VLBONIFIC, 0),
         PCPEDC.VLFRETE,
         PCPEDC.VLENTRADA,
         PCPEDC.NUMPEDENTFUT,
         PCPEDC.NUMPEDWEB,
         PCPEDC.NUMPEDMKTPLACE,
         PCPEDC.VLDESCONTOCUPOM,
         NVL(PCPEDC.PAGAMENTOAPROVADOCIASHOP, 'N')
         ,PCPEDC.NUMCUPOM
         ,PCPEDC.TOTVOLUME
         ,NVL(pcpedc.utilizavendaporembalagem, 'N')
         ,PCPEDC.CODIGORASTREIOFRETEVENDA
  ORDER BY NVL(PCPEDC.DTENTREGA, PCPEDC.DATA) DESC, NVL(PCPEDC.HORA,0) DESC, NVL(PCPEDC.MINUTO,0) DESC
) WHERE ROWNUM <= :LIMIT
`;

// Consulta de Produtos do Pedido (exatamente como no arquivo pedido_vendas_e_produtos.txt)
const PRODUTOS_SQL = `
SELECT DISTINCT I.NUMSEQ, I.VLIPI, I.PERCIPI,
           P.NBM,
           I.CODPROD,
           P.DESCRICAO,
           P.CODFAB,
           P.CODSEC,
           P.CODEPTO,
           P.CODCATEGORIA,
           PSECAO.DESCRICAO AS SECAO,
           PDEPTO.DESCRICAO AS DEPARTAMENTO,
           PCAT.CATEGORIA AS CATEGORIA,
           I.NUMLOTE,
       I.CODFUNCSEP CODFUNCSEP,
       PCEMPR.NOME SEPARADOPOR,
  P.EMBALAGEM,
(I.QT / DECODE(NVL(I.QTUNITEMB,1),0,1,I.QTUNITEMB)) QTUNITEMB,
(I.QTUNITEMB * I.PVENDA)PVENDAEMB,
       I.QT,
       I.PVENDA,
           ROUND(I.QT * I.PVENDA, 2) SUBTOTAL,
           I.ST,
           I.NUMPED,
           I.DTLANC,
           I.CODFUNCLANC,
           I.ROTINALANC,
           I.CODFUNCULTALTER,
           I.ROTINAULTLALTER,
           I.DTULTLALTER,
       (((( nvl(I.PTABELA,0) - nvl(I.PVENDA,0)) / decode( nvl(I.PTABELA,0),0,1, nvl(I.ptabela,1)) ) * 100) ) PERDESC, 
           I.QT *(NVL(I.PTABELA,0) - NVL(I.PVENDA,0)) * -1 VLDESC,
           NVL(I.CODFILIALRETIRA,C.CODFILIAL) CODFILIALRETIRA,
           NVL(I.PVENDA,0) - NVL(I.ST,0) - NVL(I.VLIPI,0) PLIQUIDO,
           ' ' HORACANC,
           I.TIPOENTREGA,
           I.PORIGINAL,
          DECODE(C.CONDVENDA, 5, 0, NVL(I.PRECOFVBRUTO, I.PORIGINAL)) PRECORIGINAL,
           F.CODFORNEC,
           F.FORNECEDOR,
           P.CODMARCA,
           M.MARCA,
           I.POLITICAPRIORITARIA, 
           I.CODIGOBRINDE AS CAMPBRINDE,
       P.CODAUXILIAR,
           I.PERCOM,
           NVL(I.BONIFIC, 'N') BONIFIC,
           NVL(I.CODIGOBRINDE,0) CODIGOBRINDE,
           I.PRECOMAXCONSUM,
           I.PERBONIFIC,
           I.PERDESCCOM,
           I.DESCPRECOFAB,
           P.DESCRICAO7, 
           I.CODUSUR, 
           U.NOME, 
           S.CODSUPERVISOR,
           S.NOME NOMESUPERVISOR,
       (select GREATEST(PCEST.QTBLOQUEADA,0) from PCEST where PCEST.CODPROD = I.CODPROD and PCEST.CODFILIAL = NVL(I.CODFILIALRETIRA, :CODFILIAL)) QTBLOQUEADA,
           NVL(I.VLBONIFIC, 0) VLBONIFIC,
           I.NUMPEDCLI,
           I.NUMITEMPED,
           I.CODDEPOSITO,
           D.DESCRICAO AS DEPOSITO
      from PCPEDI I,
           PCPRODUT P, 
           PCPEDC C,
           PCEMPR,
           PCFORNEC F,
           PCMARCA M, 
           PCUSUARI U, 
           PCSUPERV S, 
           PCESTOQUEDEPOSITO D,
           PCSECAO PSECAO,
           PCDEPTO PDEPTO,
           PCCATEGORIA PCAT 
Where I.NUMPED  = C.NUMPED 
   AND I.CODFUNCSEP = PCEMPR.MATRICULA(+)
   AND P.CODMARCA = M.CODMARCA(+)
   AND I.CODUSUR = U.CODUSUR (+)
   AND I.CODSUPERVISOR = S.CODSUPERVISOR (+)
     AND I.CODDEPOSITO = D.CODDEPOSITO(+) 
     AND I.CODFILIALRETIRA = D.CODFILIAL(+) 
       AND I.CODPROD = P.CODPROD 
       AND P.CODSEC = PSECAO.CODSEC(+)
       AND P.CODEPTO = PDEPTO.CODEPTO(+)
       AND P.CODCATEGORIA = PCAT.CODCATEGORIA(+)
       AND I.NUMPED  = :NUMPED
       AND P.CODFORNEC = F.CODFORNEC(+) 
ORDER BY I.NUMSEQ
`;

function buildPedidoVenda(r) {
  const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    numped: String(row.numped || '').trim(),
    recarga: row.recarga,
    dtentrega: formatDateISODate(row.dtentrega),
    tempo_hora: toNumberSafe(row.tempo_hora),
    cl_tempo_total: row.cltempototal,
    numpedcli: row.numpedcli,
    numitens: toNumberSafe(row.numitens),
    recebido: row.recebido,
    endercom: row.endercom,
    fantasia: row.fantasia,
    codusur2: row.codusur2,
    rca2: row.rca2,
    codcidade: toNumberSafe(row.codcidade),
    nomecidade: row.nomecidade,
    codpraca: toNumberSafe(row.codpraca),
    praca: row.praca,
    enderent: row.enderent,
    cgcent: row.cgcent,
    pontorefer: row.pontorefer,
    codfornecfrete: toNumberSafe(row.codfornecfrete),
    numseqentrega: toNumberSafe(row.numseqentrega),
    codfornecredespacho: toNumberSafe(row.codfornecredespacho),
    codfuncajud: toNumberSafe(row.codfuncajud),
    forneccfrete: row.forneccfrete,
    fornecdespacho: row.fornecdespacho,
    fretedespacho: row.fretedespacho,
    dtexportacao: formatDateISODate(row.dtexportacao),
    dtimportacao: formatDateISODate(row.dtimportacao),
    numviasmapasep: toNumberSafe(row.numviasmapasep),
    numpedrca: row.numpedrca,
    codfilial: normalizeCodigoFilial(row.codfilial),
    codfilialnf: normalizeCodigoFilial(row.codfilialnf),
    condvenda: toNumberSafe(row.condvenda),
    data: formatDateISODate(row.data),
    dtcancel: formatDateISODate(row.dtcancel),
    posicao: row.posicao,
    codcli: row.codcli,
    cliente: row.cliente,
    ufrg: row.ufrg,
    estent: row.estent,
    vltotal: toNumberSafe(row.vltotal),
    vlatend: toNumberSafe(row.vlatend),
    codusur: row.codusur,
    numcar: row.numcar,
    nome: row.nome,
    codeemitente: toNumberSafe(row.codeemitente),
    codfunclibera: toNumberSafe(row.codfunclibera),
    codfuncconf: toNumberSafe(row.codfuncconf),
    codplpag: toNumberSafe(row.codplpag),
    descricao: row.descricao,
    prazo1: toNumberSafe(row.prazo1),
    prazo2: toNumberSafe(row.prazo2),
    prazo3: toNumberSafe(row.prazo3),
    prazo4: toNumberSafe(row.prazo4),
    prazo5: toNumberSafe(row.prazo5),
    prazo6: toNumberSafe(row.prazo6),
    prazo7: toNumberSafe(row.prazo7),
    prazo8: toNumberSafe(row.prazo8),
    prazo9: toNumberSafe(row.prazo9),
    prazo10: toNumberSafe(row.prazo10),
    prazo11: toNumberSafe(row.prazo11),
    prazo12: toNumberSafe(row.prazo12),
    prazomedio: toNumberSafe(row.prazomedio),
    obs: row.obs,
    obs1: row.obs1,
    obs2: row.obs2,
    obsentrega1: row.obsentrega1,
    obsentrega2: row.obsentrega2,
    obsentrega3: row.obsentrega3,
    hora: toNumberSafe(row.hora),
    minuto: toNumberSafe(row.minuto),
    codcob: row.codcob,
    numcaixa: toNumberSafe(row.numcaixa),
    numtransvenda: toNumberSafe(row.numtransvenda),
    dtfat: formatDateISODate(row.dtfat),
    horafat: toNumberSafe(row.horafat),
    minutofat: toNumberSafe(row.minutofat),
    horamon: toNumberSafe(row.horamon),
    minutomon: toNumberSafe(row.minutomon),
    dtlibera: formatDateISODate(row.dtlibera),
    motivoposicao: row.motivoposicao,
    perclucro: toNumberSafe(row.perclucro),
    horalib: row.horalib,
    numpedtv3: row.numpedtv3,
    codclinf: row.codclinf,
    origemped: row.origemped,
    dtaberturapedpalm: formatDateISODate(row.dtaberturapedpalm),
    dtfechamentopedpalm: formatDateISODate(row.dtfechamentopedpalm),
    vlentrada: toNumberSafe(row.vlentrada),
    numpedentfut: row.numpedentfut,
    numpedweb: row.numpedweb,
    numpedmktplace: row.numpedmktplace,
    vldescontocupom: toNumberSafe(row.vldescontocupom),
    pagamento_aprovado_ciashop: row.pagamentoaprovadociashop,
    vlbonific: toNumberSafe(row.vlbonific),
    nomeemitente: row.nomeemitente,
    cmotorista: row.cmotorista,
    clnomefunclibera: row.clnomefunclibera,
    clnomefuncconf: row.clnomefuncconf,
    nomefuncajudante: row.nomefuncajudante,
    ccodmotorista: toNumberSafe(row.ccodmotorista),
    dtsaidacarreg: formatDateISODate(row.dtsaidacarreg),
    cplaca: row.cplaca,
    cnumnota: row.cnumnota ? String(row.cnumnota).trim() : row.cnumnota,
    totpeso: toNumberSafe(row.totpeso),
    utilizavendaporembalagem: row.utilizavendaporembalagem,
    horacanc: row.horacanc,
    vlfrete: toNumberSafe(row.vlfrete),
    tot_bonific: toNumberSafe(row.tot_bonific),
    aguardandosefaz: row.aguardandosefaz,
    totvolume: toNumberSafe(row.totvolume),
    tipo_transferencia: toNumberSafe(row.tipo_transferencia),
    codigorastreiofretevenda: row.codigorastreiofretevenda,
    numcupom: row.numcupom ? String(row.numcupom).trim() : row.numcupom
  };
}

function buildPedidoVendaItem(r) {
  const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    numped: String(row.numped || '').trim(),
    numseq: toNumberSafe(row.numseq),
    vlipi: toNumberSafe(row.vlipi),
    percipi: toNumberSafe(row.percipi),
    nbm: row.nbm,
    codprod: toNumberSafe(row.codprod),
    descricao: row.descricao,
    codfab: row.codfab,
    codsec: toNumberSafe(row.codsec),
    codepto: toNumberSafe(row.codepto),
    codcategoria: toNumberSafe(row.codcategoria),
    secao: row.secao,
    departamento: row.departamento,
    categoria: row.categoria,
    numlote: row.numlote,
    codfuncsep: toNumberSafe(row.codfuncsep),
    separadopor: row.separadopor,
    embalagem: row.embalagem,
    qtunitemb: toNumberSafe(row.qtunitemb),
    pvendaemb: toNumberSafe(row.pvendaemb),
    qt: toNumberSafe(row.qt),
    pvenda: toNumberSafe(row.pvenda),
    subtotal: toNumberSafe(row.subtotal),
    st: toNumberSafe(row.st),
    dtlanc: row.dtlanc,
    codfunclanc: toNumberSafe(row.codfunclanc),
    rotinalanc: row.rotinalanc,
    codfuncultalter: toNumberSafe(row.codfuncultalter),
    rotinaultlalter: row.rotinaultlalter,
    dtultlalter: row.dtultlalter,
    perdesc: toNumberSafe(row.perdesc),
    vldesc: toNumberSafe(row.vldesc),
    codfilialretira: normalizeCodigoFilial(row.codfilialretira),
    pliquido: toNumberSafe(row.pliquido),
    horacanc: row.horacanc,
    tipoentrega: row.tipoentrega,
    original: toNumberSafe(row.original),
    precoriginal: toNumberSafe(row.precoriginal),
    codfornec: toNumberSafe(row.codfornec),
    fornecedor: row.fornecedor,
    codmarca: toNumberSafe(row.codmarca),
    marca: row.marca,
    politicaprioritaria: row.politicaprioritaria,
    campbrinde: toNumberSafe(row.campbrinde),
    codauxiliar: row.codauxiliar,
    percom: toNumberSafe(row.percom),
    bonific: row.bonific,
    codigobrinde: toNumberSafe(row.codigobrinde),
    precomaxconsum: toNumberSafe(row.precomaxconsum),
    perbonific: toNumberSafe(row.perbonific),
    perdesccom: toNumberSafe(row.perdesccom),
    descprecofab: toNumberSafe(row.descprecofab),
    descricao7: row.descricao7,
    codusur: row.codusur,
    nome: row.nome,
    codsupervisor: toNumberSafe(row.codsupervisor),
    nomesupervisor: row.nomesupervisor,
    qtbloqueada: toNumberSafe(row.qtbloqueada),
    vlbonific: toNumberSafe(row.vlbonific),
    numpedcli: row.numpedcli,
    numitemped: toNumberSafe(row.numitemped),
    coddeposito: toNumberSafe(row.coddeposito),
    deposito: row.deposito
  };
}

async function fetchPedidos(oconn, dtini, dtfim) {
  const rawCodfunc = process.env.CODFUNC || process.env.ORACLE_CODFUNC;
  const codfunc = rawCodfunc ? Number(rawCodfunc) : null; // quando ausente, libera os filtros de PCLIB
  const binds = {
    DTINI: { val: dtini, type: oracledb.DATE },
    DTFIM: { val: dtfim, type: oracledb.DATE },
    CODFUNC: codfunc
  };
  if (!rawCodfunc) {
    console.warn('Aviso: CODFUNC não definido no .env; filtros por PCLIB serão ignorados.');
  }
  console.log('Binds Oracle:', {
    DTINI: moment(dtini).format('YYYY-MM-DD HH:mm:ss'),
    DTFIM: moment(dtfim).format('YYYY-MM-DD HH:mm:ss'),
    CODFUNC: codfunc ?? '(sem filtro)'
  });
  const result = await oconn.execute(PEDIDOS_SQL, binds);
  const rows = result.rows || [];
  if (rows.length > 0) {
    const sample = rows.slice(0, 3).map(r => formatDateForLog(r.DATA || r.data));
    console.log('Amostra de DATA dos primeiros pedidos:', sample);
    const datas = rows.map(r => r.DATA || r.data).filter(Boolean);
    const mDates = datas.map(d => parseDateFlexible(d)).filter(md => md && md.isValid());
    if (mDates.length) {
      const min = mDates.reduce((a, b) => (a.isBefore(b) ? a : b));
      const max = mDates.reduce((a, b) => (a.isAfter(b) ? a : b));
      console.log('Intervalo de DATA retornado:', {
        min: min.format('YYYY-MM-DD HH:mm:ss'),
        max: max.format('YYYY-MM-DD HH:mm:ss')
      });
    }
  }
  // Proteção adicional: filtra em memória fora do intervalo, caso o banco retorne algo inesperado
  const filtered = rows.filter(r => {
    const d = r.DATA || r.data;
    const md = parseDateFlexible(d);
    if (!md) return true; // se não conseguir interpretar, não bloqueia
    const ini = moment(dtini).startOf('day');
    const fim = moment(dtfim).startOf('day');
    return md.isSameOrAfter(ini) && md.isBefore(fim);
  });
  if (filtered.length !== rows.length) {
    console.log(`Filtrados em memória ${rows.length - filtered.length} pedidos fora do intervalo.`);
  }
  return filtered;
}

// Extrai a chave de ordenação/tempo baseada em DTENTREGA + HORA/MINUTO (com fallback para DATA)
function entregaKeyFromRow(row) {
  const mBase = parseDateFlexible(row.DTENTREGA || row.dtentrega || row.DATA || row.data);
  if (!mBase) return null;
  const hora = Number(row.HORA ?? row.hora ?? 0);
  const minuto = Number(row.MINUTO ?? row.minuto ?? 0);
  const h = Number.isFinite(hora) ? Math.min(Math.max(hora, 0), 23) : 0;
  const mi = Number.isFinite(minuto) ? Math.min(Math.max(minuto, 0), 59) : 0;
  return mBase.clone().hour(h).minute(mi).second(0);
}

async function fetchProdutosPorPedido(oconn, numped, codfilial) {
  const result = await oconn.execute(PRODUTOS_SQL, { NUMPED: numped, CODFILIAL: codfilial });
  return result.rows || [];
}

async function syncPeriodo(dtini, dtfim) {
  console.log(`Sincronizando período: ${moment(dtini).format('YYYY-MM-DD')} até ${moment(dtfim).format('YYYY-MM-DD')}`);
  const oconn = await getOracle();
  // A referência máxima de entrega precisa estar no escopo da função
  let maxEntregaKey = null;
  try {
    await initializeAuth();
    const pedidos = await fetchPedidos(oconn, dtini, dtfim);
    console.log(`Pedidos encontrados: ${pedidos.length}`);

    const payload = { pedidos: [] };
    const seen = new Set();
    for (const p of pedidos) {
      const numped = String(p.NUMPED || p.numped || '').trim();
      if (!numped) continue;
      if (seen.has(numped)) {
        console.warn(`Pedido duplicado no lote detectado; ignorando numped=${numped}`);
        continue;
      }
      seen.add(numped);
      const k = entregaKeyFromRow(p);
      if (k && (!maxEntregaKey || k.isAfter(maxEntregaKey))) {
        maxEntregaKey = k;
      }
      const codfilialRaw = p.CODFILIAL || p.codfilial;
      const codfilial = normalizeCodigoFilial(codfilialRaw);
      const itensRows = await fetchProdutosPorPedido(oconn, numped, codfilial);
      payload.pedidos.push({
        pedido: buildPedidoVenda(p),
        itens: itensRows.map(buildPedidoVendaItem)
      });
    }

    if (payload.pedidos.length === 0) {
      console.log('Nenhum pedido no período; pulando chamada à API.');
      return maxEntregaKey || null;
    }

    console.log(`Enviando ${payload.pedidos.length} pedidos para API...`);
    try {
      const resp = await pedidosVendasAPI.registerBatch(payload);
      console.log('Resposta API:', resp);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('Falha ao enviar lote de pedidos_vendas:', msg);
    }
  } finally {
    try { await oconn.close(); } catch {}
  }
  // Retorna a chave máxima de entrega encontrada neste período
  return maxEntregaKey || null; // quando não conseguimos extrair chave (evita undefined)
}

// Busca pedidos mais recentes do que a última referência de DTENTREGA/HORA/MINUTO
async function fetchPedidosRecentes(oconn, lastEntregaRef, limit = 500) {
  const rawCodfunc = process.env.CODFUNC || process.env.ORACLE_CODFUNC;
  const codfunc = rawCodfunc ? Number(rawCodfunc) : null;
  const entregaRefDate = lastEntregaRef ? lastEntregaRef.toDate() : moment().subtract(2, 'days').startOf('day').toDate();
  const entregaRefHora = lastEntregaRef ? lastEntregaRef.hour() : 0;
  const entregaRefMinuto = lastEntregaRef ? lastEntregaRef.minute() : 0;
  const binds = {
    DTENTREGA_REF: { val: entregaRefDate, type: oracledb.DATE },
    HORA_REF: entregaRefHora,
    MINUTO_REF: entregaRefMinuto,
    LIMIT: limit,
    CODFUNC: codfunc
  };
  if (!rawCodfunc) {
    console.warn('Aviso: CODFUNC não definido no .env; filtros por PCLIB serão ignorados (incremental).');
  }
  console.log('Binds Oracle (incremental):', {
    DTENTREGA_REF: moment(entregaRefDate).format('YYYY-MM-DD HH:mm:ss'),
    HORA_REF: entregaRefHora,
    MINUTO_REF: entregaRefMinuto,
    LIMIT: limit,
    CODFUNC: codfunc ?? '(sem filtro)'
  });
  const result = await oconn.execute(PEDIDOS_RECENTES_SQL, binds);
  return result.rows || [];
}

// Sincronização incremental a cada 30s, ordenando por DTENTREGA/HORA/MINUTO
async function syncIncremental(lastEntregaRef) {
  console.log('Sincronização incremental (DTENTREGA/HORA/MINUTO) iniciada...');
  const oconn = await getOracle();
  let newMaxRef = null;
  try {
    await initializeAuth();
    const pedidos = await fetchPedidosRecentes(oconn, lastEntregaRef, 500);
    console.log(`Pedidos recentes encontrados: ${pedidos.length}`);
    if (pedidos.length === 0) {
      return lastEntregaRef || null;
    }

    const payload = { pedidos: [] };
    const seen = new Set();
    for (const p of pedidos) {
      const numped = String(p.NUMPED || p.numped || '').trim();
      if (!numped) continue;
      if (seen.has(numped)) {
        console.warn(`Pedido duplicado no lote incremental; ignorando numped=${numped}`);
        continue;
      }
      seen.add(numped);
      const k = entregaKeyFromRow(p);
      if (k && (!newMaxRef || k.isAfter(newMaxRef))) {
        newMaxRef = k;
      }
      const codfilialRaw = p.CODFILIAL || p.codfilial;
      const codfilial = normalizeCodigoFilial(codfilialRaw);
      const itensRows = await fetchProdutosPorPedido(oconn, numped, codfilial);
      payload.pedidos.push({
        pedido: buildPedidoVenda(p),
        itens: itensRows.map(buildPedidoVendaItem)
      });
    }

    console.log(`Enviando ${payload.pedidos.length} pedidos incrementais para API...`);
    try {
      const resp = await pedidosVendasAPI.registerBatch(payload);
      console.log('Resposta API (incremental):', resp);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('Falha ao enviar lote incremental de pedidos_vendas:', msg);
    }
  } finally {
    try { await oconn.close(); } catch {}
  }
  return newMaxRef || lastEntregaRef || null;
}

async function main() {
  initOracleClient();
  const hojeInicio = moment().startOf('day').toDate();
  const hojeFim = moment(hojeInicio).add(1, 'day').toDate();
  const ontemInicio = moment().subtract(1, 'day').startOf('day').toDate();
  const ontemFim = moment(ontemInicio).add(1, 'day').toDate();

  // Ontem primeiro (consolidação), depois hoje
  const kOntem = await syncPeriodo(ontemInicio, ontemFim);
  const kHoje = await syncPeriodo(hojeInicio, hojeFim);

  // Define referência inicial para incremental pelo mais recente encontrado
  let lastEntregaRef = null;
  if (kOntem && kHoje) {
    lastEntregaRef = kOntem.isAfter(kHoje) ? kOntem : kHoje;
  } else {
    lastEntregaRef = kOntem || kHoje || moment().startOf('day');
  }

  // Agendamento incremental a cada 30 segundos
  let incrementalRunning = false;
  setInterval(async () => {
    if (incrementalRunning) {
      console.log('Incremental anterior ainda em execução; pulando este ciclo.');
      return;
    }
    incrementalRunning = true;
    try {
      const newRef = await syncIncremental(lastEntregaRef);
      if (newRef && (!lastEntregaRef || newRef.isAfter(lastEntregaRef))) {
        lastEntregaRef = newRef;
      }
    } catch (err) {
      console.error('Erro na sincronização incremental:', err);
    } finally {
      incrementalRunning = false;
    }
  }, 30_000);
}

if (require.main === module) {
  main().then(() => {
    console.log('Sincronização de pedidos e itens concluída.');
  }).catch(err => {
    console.error('Erro na sincronização de pedidos:', err);
    process.exitCode = 1;
  });
}