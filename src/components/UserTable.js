import { useState } from 'react';
import { styled } from '../../stitches.config';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}

const UserTable = ({ users = [] }) => {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, idx) => {
    copyToClipboard(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  if (users.length === 0) {
    return <EmptyState>No users yet — share Sakshi and watch this fill up.</EmptyState>;
  }

  return (
    <TableWrapper>
      <Table>
        <thead>
          <THead>
            <Th style={{ width: 36 }}>#</Th>
            <Th>Name</Th>
            <Th>Occupation</Th>
            <Th>Contact</Th>
            <Th>Referral</Th>
            <Th>Joined</Th>
            <Th style={{ width: 72 }}>Trial</Th>
            <Th style={{ width: 80 }}>Status</Th>
          </THead>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const isExpired = !!u.trialExpiredAt;
            const contact = u.contactHandle || null;
            const referralLabel = u.referralSource
              ? u.referralDetail
                ? `${u.referralSource} (${u.referralDetail})`
                : u.referralSource
              : '—';

            return (
              <TR key={u.deviceId || idx} isExpired={isExpired}>
                <Td dim>{idx + 1}</Td>
                <Td bold>{u.name || '—'}</Td>
                <Td>{u.occupation || '—'}</Td>
                <Td>
                  {contact ? (
                    <ContactCell
                      title="Click to copy"
                      onClick={() => handleCopy(contact, idx)}
                    >
                      {copied === idx ? '✓ copied' : contact}
                    </ContactCell>
                  ) : (
                    <span style={{ opacity: 0.35 }}>—</span>
                  )}
                </Td>
                <Td>{referralLabel}</Td>
                <Td dim>{formatDate(u.onboardedAt)}</Td>
                <Td dim>{u.trialDays ?? 14}d</Td>
                <Td>
                  <StatusChip expired={isExpired}>
                    {isExpired ? 'Expired' : 'Active'}
                  </StatusChip>
                </Td>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </TableWrapper>
  );
};

const TableWrapper = styled('div', {
  overflowX: 'auto',
  borderRadius: '$borderRadius',
  border: '1px solid $hover',
});

const Table = styled('table', {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
  fontFamily: 'inherit',
});

const THead = styled('tr', {
  background: '$navBackground',
  borderBottom: '2px solid $cyan',
});

const Th = styled('th', {
  padding: '10px 14px',
  textAlign: 'left',
  color: '$cyan',
  fontWeight: 600,
  fontSize: '12px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

const TR = styled('tr', {
  borderBottom: '1px solid $hover',
  transition: 'background 0.1s',
  '&:hover': { background: 'rgba(128,255,234,0.04)' },
  '&:last-child': { borderBottom: 'none' },
  variants: {
    isExpired: {
      true: { opacity: 0.6 },
      false: {},
    },
  },
});

const Td = styled('td', {
  padding: '10px 14px',
  color: '$primary',
  verticalAlign: 'middle',
  variants: {
    dim: { true: { color: '$secondary' } },
    bold: { true: { fontWeight: 600 } },
  },
});

const ContactCell = styled('span', {
  cursor: 'pointer',
  color: '$cyan',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  '&:hover': { opacity: 0.8 },
  fontSize: '12px',
  wordBreak: 'break-all',
});

const StatusChip = styled('span', {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 600,
  variants: {
    expired: {
      true: { background: 'rgba(255,80,80,0.15)', color: '#ff6b6b' },
      false: { background: 'rgba(128,255,234,0.15)', color: '#80ffea' },
    },
  },
  defaultVariants: { expired: false },
});

const EmptyState = styled('p', {
  color: '$secondary',
  padding: '40px',
  textAlign: 'center',
  fontStyle: 'italic',
});

export default UserTable;
