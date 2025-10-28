import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  QrCode as QrCodeIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  WhatsApp as WhatsAppIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';
import api from '../services/api';

// Componente QR customizado
const QRCodeComponent: React.FC<{ value: string; size?: number }> = ({ value, size = 256 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (value) {
      QRCode.toDataURL(value, { width: size })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Erro ao gerar QR Code:', err));
    }
  }, [value, size]);

  return qrDataUrl ? <img src={qrDataUrl} alt="QR Code" style={{ maxWidth: '100%' }} /> : null;
};

interface WhatsAppInstance {
  id: number;
  nome: string;
  identificador: string;
  numero_whatsapp: string | null;
  status: 'ativa' | 'inativa' | 'manutencao';
  status_conexao: 'desconectado' | 'conectando' | 'conectado' | 'erro' | 'qr_code';
  qrcode: string | null;
  session_path: string | null;
  max_envios_por_minuto: number;
  timeout_conversa_minutos: number;
  data_cadastro: string;
  data_atualizacao: string;
  ultima_conexao: string | null;
}

const WhatsAppInstances: React.FC = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [createLoading, setCreateLoading] = useState(false);
  
  // Estados para diálogos
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sendMessageDialogOpen, setSendMessageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Estados para formulários
  const [newInstance, setNewInstance] = useState({
    nome: '',
    identificador: '',
    numero_whatsapp: '',
    max_envios_por_minuto: 10,
    timeout_conversa_minutos: 30
  });
  
  const [messageForm, setMessageForm] = useState({
    to: '',
    message: ''
  });

  // Carregar instâncias com otimização para polling
  const loadInstances = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const response = await api.get('/whatsapp_instances.php');
      const newInstances = response.data;
      
      // Verificar se a instância selecionada mudou para conectado
      if (selectedInstance && qrDialogOpen) {
        const updatedSelectedInstance = newInstances.find(
          (instance: WhatsAppInstance) => instance.id === selectedInstance.id
        );
        
        // Se a instância conectou, fechar o modal de QR Code
        if (updatedSelectedInstance && updatedSelectedInstance.status_conexao === 'conectado') {
          setQrDialogOpen(false);
          setSelectedInstance(null);
          setSuccessMessage('Instância conectada com sucesso!');
        }
      }
      
      // Comparar dados para evitar re-renderizações desnecessárias
      setInstances(prevInstances => {
        const hasChanges = JSON.stringify(prevInstances) !== JSON.stringify(newInstances);
        return hasChanges ? newInstances : prevInstances;
      });
      
      setError(null);
    } catch (err: any) {
      console.error('Erro ao carregar instâncias:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar instâncias');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [selectedInstance, qrDialogOpen]);

  // Polling HTTP para atualização de status das instâncias
  useEffect(() => {
    const startPolling = () => {
      loadInstances(true); // Carregamento inicial com loading
      
      // Polling a cada 5 segundos para atualizar status (sem loading)
      const pollingInterval = setInterval(() => {
        loadInstances(false);
      }, 5000);
      
      return pollingInterval;
    };
    
    const interval = startPolling();
    
    return () => {
      clearInterval(interval);
    };
  }, [loadInstances]); // Dependência da função loadInstances

  // Limpar mensagens de sucesso após 5 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);



  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conectado': return 'success';
      case 'conectando': return 'warning';
      case 'qr_code': return 'info';
      case 'erro': return 'error';
      case 'desconectado': return 'default';
      default: return 'default';
    }
  };

  // Função para obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'conectado': return 'Conectado';
      case 'conectando': return 'Conectando';
      case 'qr_code': return 'QR Code';
      case 'erro': return 'Erro';
      case 'desconectado': return 'Desconectado';
      default: return status;
    }
  };

  // Reiniciar instância
  const restartInstance = async (instanceId: number) => {
    const actionKey = `restart_${instanceId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setError(null);
      
      await api.post(`/whatsapp_control.php?action=restart&id=${instanceId}`);
      setSuccessMessage('Instância reiniciada com sucesso!');
      
      // Atualizar status localmente para feedback imediato
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId 
          ? { ...instance, status_conexao: 'conectando' }
          : instance
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao reiniciar instância');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Parar instância
  const stopInstance = async (instanceId: number) => {
    const actionKey = `stop_${instanceId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setError(null);
      
      await api.post(`/whatsapp_control.php?action=stop&id=${instanceId}`);
      setSuccessMessage('Instância parada com sucesso!');
      
      // Atualizar status localmente para feedback imediato
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId 
          ? { ...instance, status_conexao: 'desconectado' }
          : instance
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao parar instância');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Criar nova instância
  const createInstance = async () => {
    try {
      setCreateLoading(true);
      setError(null);
      await api.post('/whatsapp_instances.php', newInstance);
      setCreateDialogOpen(false);
      setNewInstance({
        nome: '',
        identificador: '',
        numero_whatsapp: '',
        max_envios_por_minuto: 10,
        timeout_conversa_minutos: 30
      });
      setSuccessMessage('Instância criada com sucesso!');
      await loadInstances(); // Recarregar lista
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao criar instância');
    } finally {
      setCreateLoading(false);
    }
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!selectedInstance) return;
    
    const actionKey = `send_${selectedInstance.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setError(null);
      
      await api.post(`/whatsapp_control.php?action=send_message&id=${selectedInstance.id}`, messageForm);
      setSendMessageDialogOpen(false);
      setMessageForm({ to: '', message: '' });
      setSelectedInstance(null);
      setSuccessMessage('Mensagem enviada com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao enviar mensagem');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Excluir instância
  const deleteInstance = async () => {
    if (!selectedInstance) return;
    
    const actionKey = `delete_${selectedInstance.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setError(null);
      
      await api.delete(`/whatsapp_instances.php?id=${selectedInstance.id}`);
      setDeleteDialogOpen(false);
      setSelectedInstance(null);
      setSuccessMessage('Instância excluída com sucesso!');
      await loadInstances(); // Recarregar lista
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao excluir instância');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Mostrar QR Code
  const showQRCode = (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setQrDialogOpen(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          <WhatsAppIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Instâncias WhatsApp
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={(e) => loadInstances(true)}
            sx={{ mr: 2 }}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Nova Instância
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <Box display="flex" flexWrap="wrap" gap={3}>
        {instances.map((instance) => (
          <Box key={instance.id} flex="1 1 300px" minWidth="300px" maxWidth="400px">
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h2">
                    {instance.nome}
                  </Typography>
                  <Chip
                    label={getStatusText(instance.status_conexao)}
                    color={getStatusColor(instance.status_conexao) as any}
                    size="small"
                  />
                </Box>

                <Typography color="textSecondary" gutterBottom>
                  ID: {instance.identificador}
                </Typography>

                {instance.numero_whatsapp && (
                  <Typography color="textSecondary" gutterBottom>
                    Número: {instance.numero_whatsapp}
                  </Typography>
                )}

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Última conexão: {instance.ultima_conexao 
                    ? new Date(instance.ultima_conexao).toLocaleString()
                    : 'Nunca'
                  }
                </Typography>

                <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => restartInstance(instance.id)}
                    disabled={instance.status_conexao === 'conectando' || actionLoading[`restart_${instance.id}`]}
                    startIcon={actionLoading[`restart_${instance.id}`] ? <CircularProgress size={16} /> : <RefreshIcon />}
                  >
                    {actionLoading[`restart_${instance.id}`] ? 'Reiniciando...' : 'Reiniciar'}
                  </Button>

                  {instance.status_conexao === 'conectado' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => stopInstance(instance.id)}
                      disabled={actionLoading[`stop_${instance.id}`]}
                      startIcon={actionLoading[`stop_${instance.id}`] ? <CircularProgress size={16} /> : undefined}
                    >
                      {actionLoading[`stop_${instance.id}`] ? 'Parando...' : 'Parar'}
                    </Button>
                  )}

                  {instance.status_conexao === 'qr_code' && instance.qrcode && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<QrCodeIcon />}
                      onClick={() => showQRCode(instance)}
                    >
                      Ver QR
                    </Button>
                  )}

                  {/* {instance.status_conexao === 'conectado' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={actionLoading[`send_${instance.id}`] ? <CircularProgress size={16} /> : <SendIcon />}
                      onClick={() => {
                        setSelectedInstance(instance);
                        setSendMessageDialogOpen(true);
                      }}
                      disabled={actionLoading[`send_${instance.id}`]}
                    >
                      {actionLoading[`send_${instance.id}`] ? 'Enviando...' : 'Enviar'}
                    </Button>
                  )} */}

                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={actionLoading[`delete_${instance.id}`] ? <CircularProgress size={16} /> : <DeleteIcon />}
                    onClick={() => {
                      setSelectedInstance(instance);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={actionLoading[`delete_${instance.id}`]}
                  >
                    {actionLoading[`delete_${instance.id}`] ? 'Excluindo...' : 'Excluir'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Dialog para QR Code */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          QR Code - {selectedInstance?.nome}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" p={2}>
            {selectedInstance?.qrcode ? (
              <>
                <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
                  <QRCodeComponent value={selectedInstance.qrcode} size={256} />
                </Paper>
                <Typography variant="body2" color="textSecondary" textAlign="center">
                  Escaneie este QR Code com seu WhatsApp para conectar a instância
                </Typography>
              </>
            ) : (
              <Typography>QR Code não disponível</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para criar instância */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Instância WhatsApp</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Nome"
              value={newInstance.nome}
              onChange={(e) => setNewInstance({ ...newInstance, nome: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Identificador"
              value={newInstance.identificador}
              onChange={(e) => setNewInstance({ ...newInstance, identificador: e.target.value })}
              fullWidth
              required
              helperText="Identificador único para a instância"
            />
            <TextField
              label="Número do WhatsApp"
              value={newInstance.numero_whatsapp}
              onChange={(e) => setNewInstance({ ...newInstance, numero_whatsapp: e.target.value })}
              fullWidth
              helperText="Número do WhatsApp (ex: 5511999999999)"
              placeholder="5511999999999"
            />
            <TextField
              label="Max. envios por minuto"
              type="number"
              value={newInstance.max_envios_por_minuto}
              onChange={(e) => setNewInstance({ ...newInstance, max_envios_por_minuto: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Timeout conversa (minutos)"
              type="number"
              value={newInstance.timeout_conversa_minutos}
              onChange={(e) => setNewInstance({ ...newInstance, timeout_conversa_minutos: parseInt(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createLoading}>Cancelar</Button>
          <Button 
            onClick={createInstance} 
            variant="contained" 
            disabled={createLoading}
            startIcon={createLoading ? <CircularProgress size={20} /> : null}
          >
            {createLoading ? 'Criando...' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para enviar mensagem */}
      <Dialog open={sendMessageDialogOpen} onClose={() => setSendMessageDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Enviar Mensagem - {selectedInstance?.nome}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Número de destino"
              value={messageForm.to}
              onChange={(e) => setMessageForm({ ...messageForm, to: e.target.value })}
              fullWidth
              required
              helperText="Formato: 5511999999999@c.us"
            />
            <TextField
              label="Mensagem"
              value={messageForm.message}
              onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
              fullWidth
              multiline
              rows={4}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendMessageDialogOpen(false)} disabled={actionLoading[`send_${selectedInstance?.id}`]}>Cancelar</Button>
          <Button 
            onClick={sendMessage} 
            variant="contained"
            disabled={actionLoading[`send_${selectedInstance?.id}`] || !messageForm.to || !messageForm.message}
            startIcon={actionLoading[`send_${selectedInstance?.id}`] ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {actionLoading[`send_${selectedInstance?.id}`] ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para confirmar exclusão */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle color="error">
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir a instância <strong>{selectedInstance?.nome}</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Esta ação não pode ser desfeita. A instância será permanentemente removida do sistema.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading[`delete_${selectedInstance?.id}`]}>Cancelar</Button>
          <Button 
            onClick={deleteInstance} 
            variant="contained" 
            color="error"
            disabled={actionLoading[`delete_${selectedInstance?.id}`]}
            startIcon={actionLoading[`delete_${selectedInstance?.id}`] ? <CircularProgress size={16} /> : undefined}
          >
            {actionLoading[`delete_${selectedInstance?.id}`] ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WhatsAppInstances;
