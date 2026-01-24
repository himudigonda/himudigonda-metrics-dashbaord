import { styled } from '../../stitches.config';

const Card = styled('div', {
    backgroundColor: '$cardBackground',
    padding: '24px',
    borderRadius: '$borderRadius',
    border: '1px solid $hover',
    borderLeft: '4px solid',
    borderColor: '$cyan', // default
});

const Title = styled('h3', {
    color: '$secondary',
    fontSize: '16px',
    margin: 0,
});

const Value = styled('p', {
    color: '$primary',
    fontSize: '36px',
    fontWeight: 'bold',
    margin: '8px 0 0 0',
});

const MetricCard = ({ title, value, accentColor }) => {
    return (
        <Card css={{ borderLeftColor: accentColor }}>
            <Title>{title}</Title>
            <Value>{value}</Value>
        </Card>
    );
};

export default MetricCard;
