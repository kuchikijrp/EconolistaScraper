export interface PointsLog {
  userId: string;
  amount: number;
  type: 'EARN' | 'SPEND';
  description: string;
  receiptId: string;
  actionType: string;
}

// data: {
//     userId: userId,
//         amount: receiptBonus,
//             type: 'EARN',
//                 description: `Envio de nota fiscal: ${result.marketName}`,
//                     receiptId: transactionId,
//                         actionType: 'SCAN_NF'
// }
