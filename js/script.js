let dadosMensais = [];
let cotacaoEuro = 5.5; // valor inicial padrão

function formatarMoeda(valor, moeda) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
}

async function buscarCotacaoEuro() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=BRL&to=EUR");
    const data = await res.json();
    const cotacao = data.rates?.EUR;
    if (cotacao) {
      cotacaoEuro = cotacao;
    } else {
      console.warn("Cotação não encontrada na Frankfurter.app. Usando valor padrão.");
    }
  } catch (e) {
    console.warn("Erro ao buscar cotação do euro na Frankfurter.app. Usando valor padrão.");
  }
}

function valorPresente(n, valor) {
  return valor / Math.pow(1 + jurosMensal, n);
}

async function simular() {
  await buscarCotacaoEuro();

  const valorFinanciado = parseFloat(document.getElementById("valorEmprestimo").value);
  const taxa = parseFloat(document.getElementById("taxaJuros").value) / 100;
  const tipoTaxa = document.getElementById("tipoTaxa").value;
  const prazoInput = parseInt(document.getElementById("prazo").value);
  const tipoPrazo = document.getElementById("tipoPrazo").value;
  const parcelasPorMes = parseInt(document.getElementById("parcelasPorMes").value);

  // Converter taxa para mensal se necessário
  let jurosMensal;
  if (tipoTaxa === "anual") {
    jurosMensal = Math.pow(1 + taxa, 1 / 12) - 1;
  } else {
    jurosMensal = taxa;
  }

  // Converter prazo para meses se necessário
  let totalParcelas;
  if (tipoPrazo === "anos") {
    totalParcelas = prazoInput * 12;
  } else {
    totalParcelas = prazoInput;
  }

  // Calcular parcela fixa pelo sistema Price
  const parcelaFixa = (valorFinanciado * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -totalParcelas));

  let saldoDevedor = valorFinanciado;
  let mes = 1;
  dadosMensais = [];

  let primeiraParcela = 1;
  let ultimaParcela = totalParcelas;

  if (parcelasPorMes === 1) {
    // Simulação padrão Tabela Price, sem antecipação
    while (primeiraParcela <= totalParcelas) {
      const jurosAtual = saldoDevedor * jurosMensal;
      const amortizacaoAtual = parcelaFixa - jurosAtual;
      saldoDevedor -= amortizacaoAtual;

      const totalPagoMes = parcelaFixa;
      const valorEuro = totalPagoMes * cotacaoEuro;

      dadosMensais.push({
        mes: dadosMensais.length + 1,
        totalPagoMes,
        valorEuro,
        valorPorPessoa: valorEuro / 4,
      });

      primeiraParcela++;
    }
  } else {
    // Simulação com antecipação das últimas (parcelasPorMes - 1) parcelas
    while (primeiraParcela <= ultimaParcela) {
      let totalPagoMes = 0;

      // Pagar a parcela do mês vigente (parcela "primeiraParcela")
      const jurosAtual = saldoDevedor * jurosMensal;
      const amortizacaoAtual = parcelaFixa - jurosAtual;
      saldoDevedor -= amortizacaoAtual;
      totalPagoMes += parcelaFixa;

      // Pagar antecipadamente as últimas (parcelasPorMes - 1) parcelas pendentes
      for (let k = 1; k < parcelasPorMes; k++) {
        if (ultimaParcela > primeiraParcela) {
          const n = ultimaParcela - primeiraParcela; // número de meses de antecipação
          const valorPresente = parcelaFixa / Math.pow(1 + jurosMensal, n);

          // O valor presente da última parcela é suficiente para quitá-la hoje, sem afetar o saldo devedor atual
          totalPagoMes += valorPresente;

          ultimaParcela--;
        }
      }

      const valorEuro = totalPagoMes * cotacaoEuro;
      dadosMensais.push({
        mes: dadosMensais.length + 1,
        totalPagoMes,
        valorEuro,
        valorPorPessoa: valorEuro / 4,
      });

      primeiraParcela++;
    }
  }

  mostrarResultados(dadosMensais, valorFinanciado, totalParcelas, parcelaFixa);
}

function mostrarResultados(dados, valorFinanciado, totalParcelas, parcelaFixa) {
  const tabela = document.querySelector("#tabelaResultados tbody");
  tabela.innerHTML = "";
  let totalPago = 0;

  dados.forEach((d, index) => {
    totalPago += d.totalPagoMes;
    const hiddenClass = index >= 5 ? 'hidden' : '';
    const row = `<tr class="${hiddenClass}">
      <td>${d.mes}</td>
      <td>${formatarMoeda(d.totalPagoMes, 'BRL')}</td>
      <td>${formatarMoeda(d.valorEuro, 'EUR')}</td>
      <td>${formatarMoeda(d.valorPorPessoa, 'EUR')}</td>
    </tr>`;
    tabela.innerHTML += row;
  });

  let verMaisBtn = document.getElementById('verMaisBtn');
  if (!verMaisBtn) {
    verMaisBtn = document.createElement('button');
    verMaisBtn.id = 'verMaisBtn';
    verMaisBtn.className = 'ver-mais-btn';
    verMaisBtn.textContent = 'Ver mais';

    verMaisBtn.onclick = () => {
      const hiddenRows = tabela.querySelectorAll('.hidden');
      const isHidden = hiddenRows.length > 0 && hiddenRows[0].style.display !== 'table-row';
      hiddenRows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
      });
      verMaisBtn.textContent = isHidden ? 'Ver menos' : 'Ver mais';
    };

    const verMaisRow = document.createElement('tr');
    const verMaisTd = document.createElement('td');
    verMaisTd.colSpan = 4;
    verMaisTd.style.textAlign = 'center';
    verMaisTd.appendChild(verMaisBtn);
    verMaisRow.appendChild(verMaisTd);
    tabela.appendChild(verMaisRow);
  }

  const economia = parcelaFixa * totalParcelas - totalPago;

  const cotacaoBRLporEUR = 1 / cotacaoEuro;
  document.getElementById("resumo").innerHTML = `
    <p><strong>Total pago:</strong> ${formatarMoeda(totalPago, 'BRL')}</p>
    <p><strong>Economia em relação ao financiamento padrão:</strong> ${formatarMoeda(economia, 'BRL')}</p>
    <p><strong>Duração total:</strong> ${dados.length} meses</p>
    <p><strong>Cotação atual do euro: 1 € = R$ ${cotacaoBRLporEUR.toFixed(4)}</strong></p>
  `;

  const ctx = document.getElementById("graficoEconomia").getContext("2d");
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Principal (R$ " + valorFinanciado.toFixed(2) + ")", "Juros Economizados"],
      datasets: [
        {
          data: [valorFinanciado, economia],
          backgroundColor: ["#36a2eb", "#ff6384"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: {
          display: true,
          text: "Distribuição de Principal e Juros Economizados",
        },
      },
    },
  });
}

simular();

// Atualizar simulação automaticamente ao alterar os campos
const campos = [
  "valorEmprestimo",
  "taxaJuros",
  "tipoTaxa",
  "prazo",
  "tipoPrazo",
  "parcelasPorMes"
];

campos.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", simular);
    el.addEventListener("change", simular);
  }
});

function baixarExcel() {
  const wb = XLSX.utils.book_new();
  const ws_data = [
    ["Mês", "Total Pago no Mês (R$)", "Valor em Euro (€)", "Valor por Pessoa (€)"]
  ];

  dadosMensais.forEach(d => {
    ws_data.push([
      d.mes,
      d.totalPagoMes.toFixed(2),
      d.valorEuro.toFixed(2),
      d.valorPorPessoa.toFixed(2)
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Simulação");
  XLSX.writeFile(wb, "simulacao_quitacao.xlsx");
}

function baixarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Simulador de Quitação Antecipada", 14, 20);

  let y = 30;
  doc.setFontSize(12);
  doc.text(`Total pago: R$ ${dadosMensais.reduce((sum, d) => sum + d.totalPagoMes, 0).toFixed(2)}`, 14, y);
  y += 8;
  const economia = (3677.97 * 120) - dadosMensais.reduce((sum, d) => sum + d.totalPagoMes, 0);
  doc.text(`Economia em relação ao financiamento padrão: R$ ${economia.toFixed(2)}`, 14, y);
  y += 8;
  doc.text(`Duração total: ${dadosMensais.length} meses`, 14, y);
  y += 12;

  doc.setFontSize(14);
  doc.text("Tabela de Pagamentos", 14, y);
  y += 8;

  doc.setFontSize(10);
  const headers = ["Mês", "Total Pago (R$)", "Euro (€)", "Por Pessoa (€)"];
  const colWidths = [20, 50, 40, 40];
  let startY = y;

  // Cabeçalho
  let x = 14;
  headers.forEach((header, i) => {
    doc.text(header, x, startY);
    x += colWidths[i];
  });

  // Dados
  startY += 6;
  dadosMensais.forEach(d => {
    let x = 14;
    const row = [
      d.mes.toString(),
      d.totalPagoMes.toFixed(2),
      d.valorEuro.toFixed(2),
      d.valorPorPessoa.toFixed(2)
    ];
    row.forEach((cell, i) => {
      doc.text(cell, x, startY);
      x += colWidths[i];
    });
    startY += 6;
    if (startY > 280) { // quebra de página
      doc.addPage();
      startY = 20;
    }
  });

  doc.save("simulacao_quitacao.pdf");
}

window.simular = simular;
window.baixarExcel = baixarExcel;
window.baixarPDF = baixarPDF;
